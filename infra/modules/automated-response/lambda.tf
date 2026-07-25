data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix = "prahari-response"
}

# ---------------------------------------------------------------------------------------------------------------------
# IDENTITY LOOKUP LAMBDA
# ---------------------------------------------------------------------------------------------------------------------
data "aws_iam_policy_document" "lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "identity_lookup" {
  name               = "${local.name_prefix}-identity-lookup-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

data "aws_iam_policy_document" "identity_lookup_permissions" {
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
    sid    = "ReadTrustScores"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem"
    ]
    resources = [var.trust_scores_table_arn]
  }
}

resource "aws_iam_role_policy" "identity_lookup" {
  name   = "${local.name_prefix}-identity-lookup-policy"
  role   = aws_iam_role.identity_lookup.id
  policy = data.aws_iam_policy_document.identity_lookup_permissions.json
}

data "archive_file" "identity_lookup_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../services/response-playbooks/src/identity_lookup.py"
  output_path = "${path.module}/identity-lookup.zip"
}

resource "aws_lambda_function" "identity_lookup" {
  filename         = data.archive_file.identity_lookup_zip.output_path
  function_name    = "${local.name_prefix}-identity-lookup"
  role             = aws_iam_role.identity_lookup.arn
  handler          = "identity_lookup.lambda_handler"
  runtime          = "python3.12"
  timeout          = 15
  source_code_hash = data.archive_file.identity_lookup_zip.output_base64sha256

  environment {
    variables = {
      SCORES_TABLE_NAME    = var.trust_scores_table_name
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
    }
  }
}
