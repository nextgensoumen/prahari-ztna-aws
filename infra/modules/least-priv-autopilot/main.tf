data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix = "prahari-autopilot"
}

# ---------------------------------------------------------------------------------------------------------------------
# ACCESS ANALYZER
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_accessanalyzer_analyzer" "account" {
  analyzer_name = "${local.name_prefix}-account"
  type          = "ACCOUNT"
}

resource "aws_accessanalyzer_analyzer" "unused_access" {
  analyzer_name = "${local.name_prefix}-unused-access"
  type          = "ACCOUNT_UNUSED_ACCESS"
}

# ---------------------------------------------------------------------------------------------------------------------
# SECRETS MANAGER FOR GITHUB TOKEN
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "github_token" {
  name        = "${local.name_prefix}-github-token"
  description = "GitHub PAT or App Key for Prahari Least Privilege Autopilot"
  # Value is purposely left empty; to be populated manually
}

# ---------------------------------------------------------------------------------------------------------------------
# POLICY DIFF BOT LAMBDA
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

resource "aws_iam_role" "diff_bot_role" {
  name               = "${local.name_prefix}-diff-bot-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

data "aws_iam_policy_document" "diff_bot_policy" {
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
    sid    = "IAMReadOnly"
    effect = "Allow"
    actions = [
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "SecretsManagerGet"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue"
    ]
    resources = [aws_secretsmanager_secret.github_token.arn]
  }
}

resource "aws_iam_role_policy" "diff_bot_policy" {
  name   = "${local.name_prefix}-diff-bot-policy"
  role   = aws_iam_role.diff_bot_role.id
  policy = data.aws_iam_policy_document.diff_bot_policy.json
}

data "archive_file" "diff_bot_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../services/policy-diff-bot/src/main.py"
  output_path = "${path.module}/diff-bot.zip"
}

resource "aws_lambda_function" "diff_bot" {
  filename         = data.archive_file.diff_bot_zip.output_path
  function_name    = "${local.name_prefix}-diff-bot"
  role             = aws_iam_role.diff_bot_role.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  source_code_hash = data.archive_file.diff_bot_zip.output_base64sha256

  environment {
    variables = {
      GITHUB_REPO = var.github_repo
      SECRET_ARN  = aws_secretsmanager_secret.github_token.arn
    }
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# STEP FUNCTIONS STATE MACHINE
# ---------------------------------------------------------------------------------------------------------------------
data "aws_iam_policy_document" "sfn_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sfn_role" {
  name               = "${local.name_prefix}-sfn-role"
  assume_role_policy = data.aws_iam_policy_document.sfn_trust.json
}

data "aws_iam_policy_document" "sfn_policy" {
  statement {
    sid    = "AccessAnalyzerGenerate"
    effect = "Allow"
    actions = [
      "accessanalyzer:StartPolicyGeneration",
      "accessanalyzer:GetGeneratedPolicy",
      "accessanalyzer:ListPolicyGenerations"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "InvokeDiffBot"
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction"
    ]
    resources = [aws_lambda_function.diff_bot.arn]
  }
}

resource "aws_iam_role_policy" "sfn_policy" {
  name   = "${local.name_prefix}-sfn-policy"
  role   = aws_iam_role.sfn_role.id
  policy = data.aws_iam_policy_document.sfn_policy.json
}

resource "aws_sfn_state_machine" "autopilot" {
  name     = "${local.name_prefix}-state-machine"
  role_arn = aws_iam_role.sfn_role.arn

  definition = templatefile("${path.module}/step-functions/autopilot.asl.json", {
    DiffBotFunctionName = aws_lambda_function.diff_bot.arn
  })
}

# ---------------------------------------------------------------------------------------------------------------------
# DISCOVERY BOT LAMBDA
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_iam_role" "discovery_bot_role" {
  name               = "${local.name_prefix}-discovery-bot-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

data "aws_iam_policy_document" "discovery_bot_policy" {
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
    sid    = "IAMReadOnly"
    effect = "Allow"
    actions = [
      "iam:ListRoles",
      "iam:GetRole"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "StartStateMachine"
    effect = "Allow"
    actions = [
      "states:StartExecution"
    ]
    resources = [aws_sfn_state_machine.autopilot.arn]
  }
}

resource "aws_iam_role_policy" "discovery_bot_policy" {
  name   = "${local.name_prefix}-discovery-bot-policy"
  role   = aws_iam_role.discovery_bot_role.id
  policy = data.aws_iam_policy_document.discovery_bot_policy.json
}

data "archive_file" "discovery_bot_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../services/policy-diff-bot/src/discovery.py"
  output_path = "${path.module}/discovery-bot.zip"
}

resource "aws_lambda_function" "discovery_bot" {
  filename         = data.archive_file.discovery_bot_zip.output_path
  function_name    = "${local.name_prefix}-discovery-bot"
  role             = aws_iam_role.discovery_bot_role.arn
  handler          = "discovery.lambda_handler"
  runtime          = "python3.12"
  timeout          = 120
  source_code_hash = data.archive_file.discovery_bot_zip.output_base64sha256

  environment {
    variables = {
      STATE_MACHINE_ARN = aws_sfn_state_machine.autopilot.arn
    }
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# EVENTBRIDGE SCHEDULER (WEEKLY TRIGGER)
# ---------------------------------------------------------------------------------------------------------------------
data "aws_iam_policy_document" "scheduler_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler_role" {
  name               = "${local.name_prefix}-scheduler-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_trust.json
}

data "aws_iam_policy_document" "scheduler_policy" {
  statement {
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction"
    ]
    resources = [
      aws_lambda_function.discovery_bot.arn,
      "${aws_lambda_function.discovery_bot.arn}:*"
    ]
  }
}

resource "aws_iam_role_policy" "scheduler_policy" {
  name   = "${local.name_prefix}-scheduler-policy"
  role   = aws_iam_role.scheduler_role.id
  policy = data.aws_iam_policy_document.scheduler_policy.json
}

resource "aws_scheduler_schedule" "weekly_discovery" {
  name       = "${local.name_prefix}-weekly-discovery"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(7 days)"

  target {
    arn      = aws_lambda_function.discovery_bot.arn
    role_arn = aws_iam_role.scheduler_role.arn
  }
}
