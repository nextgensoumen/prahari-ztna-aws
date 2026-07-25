data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ---------------------------------------------------------------------------------------------------------------------
# TRUST SCORES TABLE
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_dynamodb_table" "trust_scores" {
  name         = "${local.name_prefix}-trust-scores"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "principal"

  attribute {
    name = "principal"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# RISK ENGINE LAMBDA
# ---------------------------------------------------------------------------------------------------------------------
data "aws_iam_policy_document" "risk_engine_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "risk_engine" {
  name               = "${local.name_prefix}-risk-engine-role"
  assume_role_policy = data.aws_iam_policy_document.risk_engine_trust.json
}

data "aws_iam_policy_document" "risk_engine_permissions" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }

  statement {
    sid    = "ReadEvents"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query"
    ]
    resources = [
      "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.events_table_name}",
      "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.events_table_name}/index/*"
    ]
  }

  statement {
    sid    = "WriteScores"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem"
    ]
    resources = [aws_dynamodb_table.trust_scores.arn]
  }

  statement {
    sid    = "EmitCustomEvents"
    effect = "Allow"
    actions = [
      "events:PutEvents"
    ]
    resources = [var.signal_bus_arn]
  }

  statement {
    sid    = "SQSDlq"
    effect = "Allow"
    actions = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.risk_engine_dlq.arn]
  }
}

resource "aws_iam_role_policy" "risk_engine" {
  name   = "${local.name_prefix}-risk-engine-policy"
  role   = aws_iam_role.risk_engine.id
  policy = data.aws_iam_policy_document.risk_engine_permissions.json
}

data "archive_file" "risk_engine_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../services/risk-engine/src/main.py"
  output_path = "${path.module}/risk-engine.zip"
}

resource "aws_lambda_function" "risk_engine" {
  filename         = data.archive_file.risk_engine_zip.output_path
  function_name    = "${local.name_prefix}-risk-engine"
  role             = aws_iam_role.risk_engine.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  source_code_hash = data.archive_file.risk_engine_zip.output_base64sha256
  reserved_concurrent_executions = 20

  environment {
    variables = {
      EVENTS_TABLE_NAME = var.events_table_name
      SCORES_TABLE_NAME = aws_dynamodb_table.trust_scores.name
      SIGNAL_BUS_NAME   = var.signal_bus_arn
      RISK_THRESHOLD    = tostring(var.risk_score_threshold)
    }
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.risk_engine_dlq.arn
  }
}

resource "aws_sqs_queue" "risk_engine_dlq" {
  name = "${local.name_prefix}-risk-engine-dlq"
  sqs_managed_sse_enabled = true
}

resource "aws_cloudwatch_metric_alarm" "risk_engine_dlq_alarm" {
  alarm_name          = "${local.name_prefix}-risk-engine-dlq-not-empty"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alarm when risk engine DLQ has messages"
  dimensions = {
    QueueName = aws_sqs_queue.risk_engine_dlq.name
  }
}

# Permission for EventBridge to invoke risk engine
resource "aws_lambda_permission" "allow_signal_bus" {
  statement_id  = "AllowExecutionFromSignalBus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.risk_engine.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.risk_engine_trigger.arn
}

# EventBridge rule on the custom prahari-signal-bus to trigger risk engine on every normalized event
resource "aws_cloudwatch_event_rule" "risk_engine_trigger" {
  name           = "${local.name_prefix}-risk-engine-trigger"
  description    = "Trigger risk engine for every event on the Prahari signal bus"
  event_bus_name = var.signal_bus_arn

  event_pattern = jsonencode({
    source = [{ "prefix": "" }]
  })
}

resource "aws_cloudwatch_event_target" "risk_engine_target" {
  rule           = aws_cloudwatch_event_rule.risk_engine_trigger.name
  event_bus_name = var.signal_bus_arn
  target_id      = "RiskEngineLambda"
  arn            = aws_lambda_function.risk_engine.arn
}
