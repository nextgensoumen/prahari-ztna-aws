"""
Unit tests for the Prahari Signal Normalizer Lambda.

Tests cover:
  - GuardDuty normalization (all resource types, severity mapping)
  - Security Hub normalization (label → enum, INFORMATIONAL → low)
  - CloudTrail normalization (principal extraction, severity classification)
  - lambda_handler routing and error handling
"""

import pytest
import os
import importlib.util
from unittest.mock import patch, MagicMock

os.environ["TABLE_NAME"] = "test-platform-events"

_MODULE_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../services/signal-normalizer/src/main.py")
)

with patch("boto3.resource"):
    spec = importlib.util.spec_from_file_location("normalizer_main", _MODULE_PATH)
    normalizer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(normalizer)

normalize_guardduty   = normalizer.normalize_guardduty
normalize_securityhub = normalizer.normalize_securityhub
normalize_cloudtrail  = normalizer.normalize_cloudtrail
normalize_prahari     = normalizer.normalize_prahari
get_guardduty_severity = normalizer.get_guardduty_severity
lambda_handler        = normalizer.lambda_handler


# ── GuardDuty Severity Mapping ────────────────────────────────────────────────
class TestGuardDutySeverityMapping:
    def test_below_4_is_low(self):
        assert get_guardduty_severity(0.0) == "low"
        assert get_guardduty_severity(3.9) == "low"

    def test_4_to_7_is_medium(self):
        assert get_guardduty_severity(4.0) == "medium"
        assert get_guardduty_severity(6.9) == "medium"

    def test_7_to_9_is_high(self):
        assert get_guardduty_severity(7.0) == "high"
        assert get_guardduty_severity(8.9) == "high"

    def test_9_and_above_is_critical(self):
        assert get_guardduty_severity(9.0)  == "critical"
        assert get_guardduty_severity(10.0) == "critical"


# ── GuardDuty Normalization ───────────────────────────────────────────────────
class TestNormalizeGuardDuty:
    BASE_EVENT = {
        "id": "gd-001", "time": "2026-07-25T08:00:00Z",
        "source": "aws.guardduty",
        "detail": {
            "severity": 8.5,
            "title": "Unauthorized IAM Role Assumption",
            "description": "Suspicious login from Tor exit node",
            "arn": "arn:aws:iam::123:role/dev",
        }
    }

    def test_source_module_is_guardduty(self):
        assert normalize_guardduty(self.BASE_EVENT)["source_module"] == "guardduty"

    def test_severity_8_5_maps_to_high(self):
        assert normalize_guardduty(self.BASE_EVENT)["severity"] == "high"

    def test_event_id_preserved(self):
        assert normalize_guardduty(self.BASE_EVENT)["event_id"] == "gd-001"

    def test_access_key_resource_extracts_username(self):
        event = {**self.BASE_EVENT, "detail": {
            **self.BASE_EVENT["detail"],
            "resource": {"resourceType": "AccessKey", "accessKeyDetails": {"userName": "alice"}}
        }}
        assert normalize_guardduty(event)["principal"] == "alice"

    def test_instance_resource_extracts_instance_id(self):
        event = {**self.BASE_EVENT, "detail": {
            **self.BASE_EVENT["detail"],
            "resource": {"resourceType": "Instance", "instanceDetails": {"instanceId": "i-0abc123"}}
        }}
        assert normalize_guardduty(event)["principal"] == "i-0abc123"

    def test_no_resource_defaults_to_unknown(self):
        assert normalize_guardduty(self.BASE_EVENT)["principal"] == "unknown"

    def test_raw_field_is_json_string(self):
        result = normalize_guardduty(self.BASE_EVENT)
        import json
        raw = json.loads(result["raw"])
        assert raw["id"] == "gd-001"


# ── Security Hub Normalization ────────────────────────────────────────────────
class TestNormalizeSecurityHub:
    def _make(self, label="HIGH"):
        return {
            "id": "sh-001", "time": "2026-07-25T08:00:00Z",
            "source": "aws.securityhub",
            "detail": {"findings": [{
                "Title": "S3 Bucket Public Access",
                "Description": "Bucket ACL modified",
                "AwsAccountId": "123456789012",
                "Severity": {"Label": label},
                "Resources": [{"Id": "arn:aws:s3:::my-bucket"}]
            }]}
        }

    def test_source_module_is_securityhub(self):
        assert normalize_securityhub(self._make())["source_module"] == "securityhub"

    def test_high_maps_to_high(self):
        assert normalize_securityhub(self._make("HIGH"))["severity"] == "high"

    def test_critical_maps_to_critical(self):
        assert normalize_securityhub(self._make("CRITICAL"))["severity"] == "critical"

    def test_medium_maps_to_medium(self):
        assert normalize_securityhub(self._make("MEDIUM"))["severity"] == "medium"

    def test_informational_maps_to_low(self):
        assert normalize_securityhub(self._make("INFORMATIONAL"))["severity"] == "low"

    def test_account_id_used_as_principal(self):
        assert normalize_securityhub(self._make())["principal"] == "123456789012"

    def test_resource_id_extracted(self):
        assert normalize_securityhub(self._make())["resource"] == "arn:aws:s3:::my-bucket"


# ── CloudTrail Normalization ──────────────────────────────────────────────────
class TestNormalizeCloudTrail:
    def _make(self, event_name, user_arn="arn:aws:iam::123:role/dev"):
        return {
            "id": f"ct-{event_name}", "time": "2026-07-25T08:00:00Z",
            "source": "aws.cloudtrail",
            "detail": {
                "eventName": event_name,
                "eventSource": "iam.amazonaws.com",
                "userIdentity": {"arn": user_arn}
            }
        }

    def test_source_module_is_cloudtrail(self):
        assert normalize_cloudtrail(self._make("ConsoleLogin"))["source_module"] == "cloudtrail"

    def test_delete_trail_is_critical(self):
        assert normalize_cloudtrail(self._make("DeleteTrail"))["severity"] == "critical"

    def test_stop_logging_is_critical(self):
        assert normalize_cloudtrail(self._make("StopLogging"))["severity"] == "critical"

    def test_attach_role_policy_is_high(self):
        assert normalize_cloudtrail(self._make("AttachRolePolicy"))["severity"] == "high"

    def test_put_role_policy_is_high(self):
        assert normalize_cloudtrail(self._make("PutRolePolicy"))["severity"] == "high"

    def test_console_login_is_low(self):
        assert normalize_cloudtrail(self._make("ConsoleLogin"))["severity"] == "low"

    def test_principal_extracted_from_arn(self):
        result = normalize_cloudtrail(self._make("ConsoleLogin"))
        assert result["principal"] == "arn:aws:iam::123:role/dev"

    def test_title_contains_event_name(self):
        result = normalize_cloudtrail(self._make("AttachRolePolicy"))
        assert "AttachRolePolicy" in result["title"]


# ── Lambda Handler Routing ────────────────────────────────────────────────────
class TestLambdaHandler:
    GD_EVENT = {
        "id": "gd-routing-001", "time": "2026-07-25T08:00:00Z",
        "source": "aws.guardduty",
        "detail": {"severity": 9.0, "title": "Test", "description": ""},
    }

    def test_handler_routes_guardduty_and_writes_to_ddb(self):
        mock_table = MagicMock()
        with patch.object(normalizer, "table", mock_table):
            result = lambda_handler(self.GD_EVENT, {})
        assert result["status"] == "success"
        mock_table.put_item.assert_called_once()

    def test_handler_propagates_ddb_error(self):
        bad_event = {"source": "aws.guardduty", "id": "bad-001",
                     "time": "T", "detail": {"severity": 5.0, "title": "X"}}
        mock_table = MagicMock()
        mock_table.put_item.side_effect = Exception("DynamoDB error")
        with patch.object(normalizer, "table", mock_table):
            with pytest.raises(Exception, match="DynamoDB error"):
                lambda_handler(bad_event, {})
