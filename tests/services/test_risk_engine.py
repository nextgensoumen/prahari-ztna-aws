"""
Unit tests for the Prahari Risk Engine.

Tests cover:
  - Each of the 8 scoring rules
  - Trust signals (MFA login score reduction)
  - Score clamping (min=0, max=100)
  - Inter-principal isolation
  - Score decay logic
"""

import pytest
import os
import importlib.util
from decimal import Decimal
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta

# ── Load risk-engine module by absolute path (avoids sys.path collisions) ────
os.environ["EVENTS_TABLE_NAME"]  = "test-events"
os.environ["SCORES_TABLE_NAME"]  = "test-scores"
os.environ["SIGNAL_BUS_NAME"]    = "arn:aws:events:us-east-1:123456789012:event-bus/prahari"
os.environ["RISK_THRESHOLD"]     = "50"
os.environ["SCORE_DECAY_RATE"]   = "5"

_MODULE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../services/risk-engine/src/main.py")
)

with patch("boto3.resource"), patch("boto3.client"):
    spec = importlib.util.spec_from_file_location("risk_engine_main", _MODULE_PATH)
    risk_engine = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(risk_engine)

compute_score         = risk_engine.compute_score
get_decayed_base_score= risk_engine.get_decayed_base_score
RISK_THRESHOLD        = risk_engine.RISK_THRESHOLD
SCORE_DECAY_RATE      = risk_engine.SCORE_DECAY_RATE


# ── Helpers ──────────────────────────────────────────────────────────────────
def make_event(source_module, severity, title="", principal="arn:aws:iam::123:role/dev"):
    return {
        "event_id":      f"test-{source_module}-{severity}",
        "source_module": source_module,
        "severity":      severity,
        "title":         title,
        "principal":     principal,
        "timestamp":     datetime.now(timezone.utc).isoformat(),
    }


# ── Rule Tests ────────────────────────────────────────────────────────────────
class TestScoringRules:
    TARGET = "arn:aws:iam::123:role/dev"

    def _score_single(self, evt):
        with patch.object(risk_engine, "get_decayed_base_score", return_value=0), \
             patch.object(risk_engine, "scores_table", MagicMock()):
            score, triggered = compute_score(self.TARGET, [evt])
        return score, triggered

    def test_guardduty_high_adds_30(self):
        evt = make_event("guardduty", "high", principal=self.TARGET)
        score, triggered = self._score_single(evt)
        assert score == 30
        assert "guardduty_high" in triggered

    def test_guardduty_critical_adds_50(self):
        evt = make_event("guardduty", "critical", principal=self.TARGET)
        score, triggered = self._score_single(evt)
        assert score == 50
        assert "guardduty_critical" in triggered

    def test_privilege_escalation_adds_25(self):
        evt = make_event("cloudtrail", "high", title="AttachRolePolicy", principal=self.TARGET)
        score, triggered = self._score_single(evt)
        assert score == 25
        assert "privilege_escalation" in triggered

    def test_put_role_policy_also_triggers_escalation(self):
        evt = make_event("cloudtrail", "high", title="PutRolePolicy", principal=self.TARGET)
        _, triggered = self._score_single(evt)
        assert "privilege_escalation" in triggered

    def test_audit_trail_tampering_adds_40(self):
        evt = make_event("cloudtrail", "critical", title="StopLogging", principal=self.TARGET)
        score, triggered = self._score_single(evt)
        assert score == 40
        assert "audit_trail_tampering" in triggered

    def test_delete_trail_also_triggers_tampering(self):
        evt = make_event("cloudtrail", "critical", title="DeleteTrail", principal=self.TARGET)
        _, triggered = self._score_single(evt)
        assert "audit_trail_tampering" in triggered

    def test_unusual_login_adds_20(self):
        evt = make_event("cloudtrail", "low", title="CloudTrail: ConsoleLogin", principal=self.TARGET)
        score, triggered = self._score_single(evt)
        assert score == 20
        assert "unusual_region_login" in triggered

    def test_sechub_high_adds_20(self):
        evt = make_event("securityhub", "high", principal=self.TARGET)
        score, triggered = self._score_single(evt)
        assert score == 20
        assert "sechub_high" in triggered

    def test_sechub_critical_also_triggers(self):
        evt = make_event("securityhub", "critical", principal=self.TARGET)
        _, triggered = self._score_single(evt)
        assert "sechub_high" in triggered

    def test_root_account_login_adds_60(self):
        root_principal = "arn:aws:iam::123:root"
        evt = make_event("cloudtrail", "critical", title="CloudTrail: ConsoleLogin",
                         principal=root_principal)
        with patch.object(risk_engine, "get_decayed_base_score", return_value=0), \
             patch.object(risk_engine, "scores_table", MagicMock()):
            score, triggered = compute_score(root_principal, [evt])
        # root_account_login (+60) + unusual_region_login (+20) both fire on ConsoleLogin
        assert score == 80
        assert "root_account_login" in triggered
        assert "unusual_region_login" in triggered

    def test_iam_user_created_adds_35(self):
        evt = make_event("cloudtrail", "high", title="CloudTrail: CreateUser",
                         principal=self.TARGET)
        score, triggered = self._score_single(evt)
        assert score == 35
        assert "iam_user_created" in triggered

    def test_mfa_login_clamps_to_zero_from_zero_base(self):
        evt = {
            "event_id": "mfa-001", "source_module": "prahari",
            "severity": "low", "title": "MFA:Login:success", "principal": self.TARGET,
        }
        score, triggered = self._score_single(evt)
        assert score == 0
        assert "mfa_used" in triggered

    def test_mfa_reduces_existing_score(self):
        mfa_evt = {
            "event_id": "mfa-002", "source_module": "prahari",
            "title": "MFA:Login:success", "severity": "low", "principal": self.TARGET,
        }
        with patch.object(risk_engine, "get_decayed_base_score", return_value=40), \
             patch.object(risk_engine, "scores_table", MagicMock()):
            score, triggered = compute_score(self.TARGET, [mfa_evt])
        assert score == 20
        assert "mfa_used" in triggered


class TestScoreClamping:
    TARGET = "arn:aws:iam::123:role/dev"

    def test_score_cannot_exceed_100(self):
        events = [
            make_event("guardduty", "critical", principal=self.TARGET),
            make_event("guardduty", "critical", principal=self.TARGET),
            make_event("cloudtrail", "critical", title="StopLogging", principal=self.TARGET),
        ]
        with patch.object(risk_engine, "get_decayed_base_score", return_value=0), \
             patch.object(risk_engine, "scores_table", MagicMock()):
            score, _ = compute_score(self.TARGET, events)
        assert score == 100

    def test_score_cannot_go_below_0(self):
        trust_event = {
            "event_id": "mfa-neg", "source_module": "prahari",
            "title": "MFA:Login:success", "severity": "low", "principal": self.TARGET,
        }
        with patch.object(risk_engine, "get_decayed_base_score", return_value=0), \
             patch.object(risk_engine, "scores_table", MagicMock()):
            score, _ = compute_score(self.TARGET, [trust_event])
        assert score == 0

    def test_events_for_other_principals_are_ignored(self):
        evt = make_event("guardduty", "critical", principal="arn:aws:iam::123:role/OTHER")
        with patch.object(risk_engine, "get_decayed_base_score", return_value=0), \
             patch.object(risk_engine, "scores_table", MagicMock()):
            score, triggered = compute_score(self.TARGET, [evt])
        assert score == 0
        assert triggered == []


class TestScoreDecay:
    TARGET = "arn:aws:iam::123:role/dev"

    def _mock_table(self, stored_score, hours_ago):
        mock_table = MagicMock()
        past_time = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        mock_table.get_item.return_value = {
            "Item": {
                "principal": self.TARGET,
                "score": Decimal(str(stored_score)),
                "timestamp": past_time.isoformat(),
            }
        }
        return mock_table

    def test_score_decays_by_rate_per_hour(self):
        with patch.object(risk_engine, "scores_table", self._mock_table(80, 4)):
            decayed = get_decayed_base_score(self.TARGET)
        assert decayed == 60  # 80 - (4h * 5/h) = 60

    def test_score_decay_clamps_to_zero(self):
        with patch.object(risk_engine, "scores_table", self._mock_table(10, 100)):
            decayed = get_decayed_base_score(self.TARGET)
        assert decayed == 0

    def test_no_decay_for_fresh_score(self):
        with patch.object(risk_engine, "scores_table", self._mock_table(50, 0)):
            decayed = get_decayed_base_score(self.TARGET)
        assert decayed == 50

    def test_no_prior_score_returns_zero(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {"Item": None}
        with patch.object(risk_engine, "scores_table", mock_table):
            decayed = get_decayed_base_score(self.TARGET)
        assert decayed == 0
