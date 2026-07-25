import os
import json
import logging
import boto3
from datetime import datetime, timezone
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
events_client = boto3.client('events')

EVENTS_TABLE_NAME  = os.environ['EVENTS_TABLE_NAME']
SCORES_TABLE_NAME  = os.environ['SCORES_TABLE_NAME']
SIGNAL_BUS_NAME    = os.environ['SIGNAL_BUS_NAME']
RISK_THRESHOLD     = int(os.environ.get('RISK_THRESHOLD', '50'))

events_table = dynamodb.Table(EVENTS_TABLE_NAME)
scores_table = dynamodb.Table(SCORES_TABLE_NAME)

# ---------------------------------------------------------------------------
# DETERMINISTIC WEIGHTED RULE TABLE
# Points are additive. Score range: 0-100, capped.
# Positive = bad signal (raises risk). Negative = trust signal (lowers risk).
# ---------------------------------------------------------------------------
RULES = [
    {
        "id":          "guardduty_high",
        "description": "GuardDuty high-severity finding for this principal",
        "points":      30,
        "match": lambda evt: (
            evt.get("source_module") == "guardduty" and
            evt.get("severity") == "high"
        )
    },
    {
        "id":          "guardduty_critical",
        "description": "GuardDuty critical-severity finding for this principal",
        "points":      50,
        "match": lambda evt: (
            evt.get("source_module") == "guardduty" and
            evt.get("severity") == "critical"
        )
    },
    {
        "id":          "unusual_region_login",
        "description": "ConsoleLogin event detected by CloudTrail",
        "points":      20,
        "match": lambda evt: (
            evt.get("source_module") == "cloudtrail" and
            "ConsoleLogin" in evt.get("title", "")
        )
    },
    {
        "id":          "privilege_escalation",
        "description": "AttachRolePolicy or PutRolePolicy performed",
        "points":      25,
        "match": lambda evt: (
            evt.get("source_module") == "cloudtrail" and
            any(op in evt.get("title", "") for op in ["AttachRolePolicy", "PutRolePolicy"])
        )
    },
    {
        "id":          "audit_trail_tampering",
        "description": "StopLogging or DeleteTrail performed",
        "points":      40,
        "match": lambda evt: (
            evt.get("source_module") == "cloudtrail" and
            any(op in evt.get("title", "") for op in ["StopLogging", "DeleteTrail"])
        )
    },
    {
        "id":          "sechub_high",
        "description": "Security Hub high-severity finding linked to this principal",
        "points":      20,
        "match": lambda evt: (
            evt.get("source_module") == "securityhub" and
            evt.get("severity") in ("high", "critical")
        )
    },
]

TRUST_SIGNALS = [
    {
        "id":          "mfa_used",
        "description": "MFA was used at login (deducted from score)",
        "points":      -20,
        # This signal comes from a Prahari custom event emitted by the broker
        "match": lambda evt: (
            evt.get("source_module") == "prahari" and
            evt.get("title", "").startswith("MFA:Login")
        )
    },
]

ALL_RULES = RULES + TRUST_SIGNALS


def compute_score(principal: str, recent_events: list) -> tuple[int, list]:
    """Apply the rule table against a list of recent events for a principal.
    Returns (score, list of triggered rule IDs)."""
    score = 0
    triggered = []

    for evt in recent_events:
        if evt.get("principal") != principal:
            continue
        for rule in ALL_RULES:
            if rule["match"](evt):
                score += rule["points"]
                triggered.append(rule["id"])

    score = max(0, min(100, score))   # clamp to [0, 100]
    return score, triggered


def get_recent_events(principal: str) -> list:
    """Query the SeverityIndex GSI for any severity, returning the last 50 events."""
    items = []
    for severity in ("low", "medium", "high", "critical"):
        response = events_table.query(
            IndexName="SeverityIndex",
            KeyConditionExpression="severity = :s",
            FilterExpression="principal = :p",
            ExpressionAttributeValues={
                ":s": severity,
                ":p": principal
            },
            ScanIndexForward=False,
            Limit=50
        )
        items.extend(response.get("Items", []))
    return items


def emit_score_updated_event(principal: str, score: int, triggered: list):
    events_client.put_events(
        Entries=[
            {
                "EventBusName": SIGNAL_BUS_NAME,
                "Source":       "prahari.risk-engine",
                "DetailType":   "RiskScoreUpdated",
                "Detail": json.dumps({
                    "principal":     principal,
                    "score":         score,
                    "threshold":     RISK_THRESHOLD,
                    "is_high_risk":  score >= RISK_THRESHOLD,
                    "triggered_rules": triggered,
                    "timestamp":     datetime.now(timezone.utc).isoformat()
                })
            }
        ]
    )


def lambda_handler(event, context):
    """
    Triggered by EventBridge on prahari-signal-bus for every normalized event.
    Recalculates the trust score for the principal in that event.
    """
    logger.info(f"Risk engine triggered by event from {event.get('source')}")

    detail = event.get("detail", {})
    principal = detail.get("principal") or event.get("detail", {}).get("principal", "")

    if not principal or principal in ("unknown", "system"):
        logger.info("No actionable principal in event, skipping.")
        return {"status": "skipped"}

    # Fetch recent events for this principal
    recent_events = get_recent_events(principal)
    score, triggered = compute_score(principal, recent_events)

    logger.info(f"Computed risk score for {principal}: {score} (triggered: {triggered})")

    # Persist score with 24h TTL
    ttl = int(datetime.now(timezone.utc).timestamp()) + (24 * 60 * 60)
    scores_table.put_item(Item={
        "principal":      principal,
        "score":          Decimal(str(score)),
        "threshold":      Decimal(str(RISK_THRESHOLD)),
        "is_high_risk":   score >= RISK_THRESHOLD,
        "triggered_rules": triggered,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "ttl":            ttl
    })

    # Emit RiskScoreUpdated custom event for automated-response to consume
    emit_score_updated_event(principal, score, triggered)

    return {
        "status":       "success",
        "principal":    principal,
        "score":        score,
        "is_high_risk": score >= RISK_THRESHOLD
    }
