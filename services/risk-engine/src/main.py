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
SCORE_DECAY_RATE   = int(os.environ.get('SCORE_DECAY_RATE', '5'))  # points/hour

events_table = dynamodb.Table(EVENTS_TABLE_NAME)
scores_table = dynamodb.Table(SCORES_TABLE_NAME)

# ---------------------------------------------------------------------------
# DETERMINISTIC WEIGHTED RULE TABLE
# Points are additive. Score range: 0-100, clamped.
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
    {
        "id":          "iam_user_created",
        "description": "Unexpected IAM User creation (shadow admin risk)",
        "points":      35,
        "match": lambda evt: (
            evt.get("source_module") == "cloudtrail" and
            "CreateUser" in evt.get("title", "")
        )
    },
    {
        "id":          "root_account_login",
        "description": "Root account console login — critical zero-trust violation",
        "points":      60,
        "match": lambda evt: (
            evt.get("source_module") == "cloudtrail" and
            "ConsoleLogin" in evt.get("title", "") and
            ":root" in evt.get("principal", "")
        )
    },
]

TRUST_SIGNALS = [
    {
        "id":          "mfa_used",
        "description": "MFA was used at login (deducted from score)",
        "points":      -20,
        "match": lambda evt: (
            evt.get("source_module") == "prahari" and
            evt.get("title", "").startswith("MFA:Login")
        )
    },
]

ALL_RULES = RULES + TRUST_SIGNALS


def get_decayed_base_score(principal: str) -> int:
    """
    Fetch the existing trust score and apply time-based decay.
    Decay rate: SCORE_DECAY_RATE points per hour since last update.
    This prevents users from being stuck at maximum risk indefinitely
    and makes the trust model more accurate and dynamic.
    """
    try:
        resp = scores_table.get_item(Key={"principal": principal})
        item = resp.get("Item")
        if not item:
            return 0

        stored_score = int(item.get("score", 0))
        last_updated = item.get("timestamp", "")

        if not last_updated:
            return stored_score

        last_time = datetime.fromisoformat(last_updated.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        elapsed_hours = (now - last_time).total_seconds() / 3600.0

        # Apply linear decay: reduce score by SCORE_DECAY_RATE per hour
        decayed_score = stored_score - int(elapsed_hours * SCORE_DECAY_RATE)
        decayed_score = max(0, decayed_score)

        if decayed_score != stored_score:
            logger.info(
                f"Score decay applied for {principal}: "
                f"{stored_score} -> {decayed_score} "
                f"(elapsed: {elapsed_hours:.1f}h, rate: {SCORE_DECAY_RATE}/h)"
            )

        return decayed_score

    except Exception as e:
        logger.warning(f"Could not fetch/decay existing score for {principal}: {e}")
        return 0


def compute_score(principal: str, recent_events: list) -> tuple:
    """
    Apply the rule table against recent events for a principal.
    Starts from decayed base score rather than zero.
    Returns (score, list of triggered rule IDs).
    """
    base_score = get_decayed_base_score(principal)
    delta = 0
    triggered = []

    for evt in recent_events:
        if evt.get("principal") != principal:
            continue
        for rule in ALL_RULES:
            if rule["match"](evt):
                delta += rule["points"]
                triggered.append(rule["id"])

    score = base_score + delta
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
                    "principal":       principal,
                    "score":           score,
                    "threshold":       RISK_THRESHOLD,
                    "is_high_risk":    score >= RISK_THRESHOLD,
                    "triggered_rules": triggered,
                    "timestamp":       datetime.now(timezone.utc).isoformat()
                })
            }
        ]
    )


def lambda_handler(event, context):
    """
    Triggered by EventBridge on prahari-signal-bus for GuardDuty, Security Hub,
    and CloudTrail events only. Recalculates the trust score with decay applied.
    """
    event_id = event.get("id", "unknown")
    logger.info(f"Risk engine triggered | event_id={event_id} source={event.get('source')}")

    detail = event.get("detail", {})
    principal = detail.get("principal") or ""

    if not principal or principal in ("unknown", "system", ""):
        logger.info(f"No actionable principal in event {event_id}, skipping.")
        return {"status": "skipped", "event_id": event_id}

    # Fetch recent events and compute score with decay
    recent_events = get_recent_events(principal)
    score, triggered = compute_score(principal, recent_events)

    logger.info(
        f"Trust score computed | principal={principal} score={score} "
        f"threshold={RISK_THRESHOLD} triggered={triggered}"
    )

    # Persist score with 24h TTL
    ttl = int(datetime.now(timezone.utc).timestamp()) + (24 * 60 * 60)
    scores_table.put_item(Item={
        "principal":       principal,
        "score":           Decimal(str(score)),
        "threshold":       Decimal(str(RISK_THRESHOLD)),
        "is_high_risk":    score >= RISK_THRESHOLD,
        "triggered_rules": triggered,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "ttl":             ttl
    })

    # Emit RiskScoreUpdated — consumed by automated-response module
    emit_score_updated_event(principal, score, triggered)

    return {
        "status":       "success",
        "event_id":     event_id,
        "principal":    principal,
        "score":        score,
        "is_high_risk": score >= RISK_THRESHOLD
    }
