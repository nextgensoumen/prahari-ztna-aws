data "aws_iam_policy_document" "lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "normalizer_role" {
  name               = "${local.name_prefix}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

data "aws_iam_policy_document" "normalizer_policy" {
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
    sid    = "DynamoDBWrite"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem"
    ]
    resources = [aws_dynamodb_table.events.arn]
  }

  statement {
    sid    = "KMSAccess"
    effect = "Allow"
    actions = [
      "kms:GenerateDataKey*",
      "kms:Decrypt*"
    ]
    resources = [aws_kms_key.main.arn]
  }
}

resource "aws_iam_role_policy" "normalizer_policy" {
  name   = "${local.name_prefix}-lambda-policy"
  role   = aws_iam_role.normalizer_role.id
  policy = data.aws_iam_policy_document.normalizer_policy.json
}

data "archive_file" "normalizer_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../services/signal-normalizer/src/main.py"
  output_path = "${path.module}/normalizer.zip"
}

resource "aws_lambda_function" "normalizer" {
  filename         = data.archive_file.normalizer_zip.output_path
  function_name    = "${local.name_prefix}-normalizer"
  role             = aws_iam_role.normalizer_role.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.12"
  timeout          = 15
  source_code_hash = data.archive_file.normalizer_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.events.name
    }
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# PERMISSIONS FOR EVENTBRIDGE TO INVOKE LAMBDA
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_lambda_permission" "allow_custom_bus" {
  statement_id  = "AllowExecutionFromCustomEventBus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.normalizer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.custom_catchall.arn
}

resource "aws_lambda_permission" "allow_guardduty" {
  statement_id  = "AllowExecutionFromGuardDutyRule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.normalizer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.guardduty.arn
}

resource "aws_lambda_permission" "allow_sechub" {
  statement_id  = "AllowExecutionFromSecHubRule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.normalizer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.securityhub.arn
}

resource "aws_lambda_permission" "allow_cloudtrail" {
  statement_id  = "AllowExecutionFromCloudTrailRule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.normalizer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cloudtrail.arn
}
