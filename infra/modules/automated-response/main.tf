# ---------------------------------------------------------------------------------------------------------------------
# EVENTBRIDGE — Route high-risk events to the response state machine
# ---------------------------------------------------------------------------------------------------------------------

# IAM role for EventBridge to start Step Functions executions
data "aws_iam_policy_document" "eb_sfn_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eb_sfn_trigger" {
  name               = "${local.name_prefix}-eb-sfn-trigger-role"
  assume_role_policy = data.aws_iam_policy_document.eb_sfn_trust.json
}

resource "aws_iam_role_policy" "eb_sfn_trigger" {
  name = "${local.name_prefix}-eb-sfn-trigger-policy"
  role = aws_iam_role.eb_sfn_trigger.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["states:StartExecution"]
      Resource = [aws_sfn_state_machine.response.arn]
    }]
  })
}

# Rule: RiskScoreUpdated with is_high_risk = true on prahari-signal-bus
resource "aws_cloudwatch_event_rule" "high_risk_score" {
  name           = "${local.name_prefix}-high-risk-trigger"
  description    = "Trigger response playbook when risk engine flags a high-risk principal"
  event_bus_name = var.signal_bus_arn

  event_pattern = jsonencode({
    source      = ["prahari.risk-engine"]
    detail-type = ["RiskScoreUpdated"]
    detail = {
      is_high_risk = [true]
    }
  })
}

resource "aws_cloudwatch_event_target" "high_risk_score_sfn" {
  rule           = aws_cloudwatch_event_rule.high_risk_score.name
  event_bus_name = var.signal_bus_arn
  target_id      = "ResponseStateMachine"
  arn            = aws_sfn_state_machine.response.arn
  role_arn       = aws_iam_role.eb_sfn_trigger.arn

  # Map the event payload into the state machine input format
  input_transformer {
    input_paths = {
      principal      = "$.detail.principal"
      score          = "$.detail.score"
      triggered_rules = "$.detail.triggered_rules"
    }
    input_template = "{\"principal\": <principal>, \"score\": <score>, \"triggered_rules\": <triggered_rules>}"
  }
}

# Fast-path rule: GuardDuty HIGH or CRITICAL findings directly on DEFAULT bus
resource "aws_cloudwatch_event_rule" "guardduty_fastpath" {
  name        = "${local.name_prefix}-guardduty-fastpath"
  description = "Fast-path: GuardDuty HIGH/CRITICAL findings directly trigger the response playbook"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ "numeric": [">=", 7] }]
    }
  })
}

resource "aws_cloudwatch_event_target" "guardduty_fastpath_sfn" {
  rule      = aws_cloudwatch_event_rule.guardduty_fastpath.name
  target_id = "ResponseStateMachineGuardDuty"
  arn       = aws_sfn_state_machine.response.arn
  role_arn  = aws_iam_role.eb_sfn_trigger.arn

  input_transformer {
    input_paths = {
      principal = "$.detail.resource.accessKeyDetails.userName"
      severity  = "$.detail.severity"
    }
    input_template = "{\"principal\": <principal>, \"score\": 75, \"triggered_rules\": [\"guardduty_fastpath\"], \"source\": \"guardduty_direct\"}"
  }
}
