resource "aws_cloudwatch_event_bus" "prahari" {
  name = "prahari-signal-bus"
}

# ---------------------------------------------------------------------------------------------------------------------
# CUSTOM BUS ROUTING
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "custom_catchall" {
  name           = "${local.name_prefix}-custom-catchall"
  event_bus_name = aws_cloudwatch_event_bus.prahari.name
  description    = "Route all Prahari custom events to the normalizer Lambda"

  event_pattern = jsonencode({
    source = [{ "prefix": "" }]
  })
}

resource "aws_cloudwatch_event_target" "custom_catchall_target" {
  rule           = aws_cloudwatch_event_rule.custom_catchall.name
  event_bus_name = aws_cloudwatch_event_bus.prahari.name
  target_id      = "NormalizerLambda"
  arn            = aws_lambda_function.normalizer.arn
}

# ---------------------------------------------------------------------------------------------------------------------
# DEFAULT BUS ROUTING
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "guardduty" {
  name        = "${local.name_prefix}-guardduty"
  description = "Route GuardDuty findings to normalizer"
  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
  })
}

resource "aws_cloudwatch_event_target" "guardduty_target" {
  rule      = aws_cloudwatch_event_rule.guardduty.name
  target_id = "NormalizerLambda"
  arn       = aws_lambda_function.normalizer.arn
}

resource "aws_cloudwatch_event_rule" "securityhub" {
  name        = "${local.name_prefix}-sechub"
  description = "Route Security Hub findings to normalizer"
  event_pattern = jsonencode({
    source      = ["aws.securityhub"]
    detail-type = ["Security Hub Findings - Imported"]
  })
}

resource "aws_cloudwatch_event_target" "securityhub_target" {
  rule      = aws_cloudwatch_event_rule.securityhub.name
  target_id = "NormalizerLambda"
  arn       = aws_lambda_function.normalizer.arn
}

resource "aws_cloudwatch_event_rule" "cloudtrail" {
  name        = "${local.name_prefix}-cloudtrail"
  description = "Route high-signal CloudTrail events to normalizer"
  event_pattern = jsonencode({
    source      = ["aws.cloudtrail"]
    detail-type = ["AWS API Call via CloudTrail"]
    detail = {
      eventName = [
        "ConsoleLogin",
        "AttachRolePolicy",
        "PutRolePolicy",
        "StopLogging",
        "DeleteTrail"
      ]
    }
  })
}

resource "aws_cloudwatch_event_target" "cloudtrail_target" {
  rule      = aws_cloudwatch_event_rule.cloudtrail.name
  target_id = "NormalizerLambda"
  arn       = aws_lambda_function.normalizer.arn
}
