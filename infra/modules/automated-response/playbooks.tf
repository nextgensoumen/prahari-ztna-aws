data "aws_caller_identity" "sfn" {}
data "aws_region" "sfn" {}

# ---------------------------------------------------------------------------------------------------------------------
# STEP FUNCTIONS EXECUTION ROLE
# ---------------------------------------------------------------------------------------------------------------------
data "aws_iam_policy_document" "sfn_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:states:${data.aws_region.sfn.name}:${data.aws_caller_identity.sfn.account_id}:stateMachine:*"]
    }
  }
}

resource "aws_iam_role" "sfn_role" {
  name               = "${local.name_prefix}-sfn-role"
  assume_role_policy = data.aws_iam_policy_document.sfn_trust.json
}

data "aws_iam_policy_document" "sfn_permissions" {
  statement {
    sid    = "InvokeLambda"
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction"
    ]
    resources = [
      aws_lambda_function.identity_lookup.arn,
      "${aws_lambda_function.identity_lookup.arn}:*"
    ]
  }

  statement {
    sid    = "CognitoSignOut"
    effect = "Allow"
    actions = [
      "cognito-idp:AdminUserGlobalSignOut"
    ]
    resources = [var.cognito_user_pool_arn]
  }

  # Attach only the AWSDenyAll managed policy — no broader IAM mutation
  statement {
    sid    = "IAMAttachDenyAll"
    effect = "Allow"
    actions = [
      "iam:AttachRolePolicy"
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.sfn.account_id}:role/*"]
    condition {
      test     = "ArnEquals"
      variable = "iam:PolicyARN"
      values   = ["arn:aws:iam::aws:policy/AWSDenyAll"]
    }
  }

  statement {
    sid    = "IAMTagRole"
    effect = "Allow"
    actions = [
      "iam:TagRole"
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.sfn.account_id}:role/*"]
  }

  statement {
    sid    = "PutSignalBusEvents"
    effect = "Allow"
    actions = [
      "events:PutEvents"
    ]
    resources = [var.signal_bus_arn]
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogDelivery",
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:DescribeResourcePolicies",
      "logs:GetLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutLogEvents",
      "logs:PutResourcePolicy",
      "logs:UpdateLogDelivery"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "sfn_policy" {
  name   = "${local.name_prefix}-sfn-policy"
  role   = aws_iam_role.sfn_role.id
  policy = data.aws_iam_policy_document.sfn_permissions.json
}

# CloudWatch log group for state machine executions
resource "aws_cloudwatch_log_group" "sfn_logs" {
  name              = "/aws/states/${local.name_prefix}-playbook"
  retention_in_days = 30
}

# ---------------------------------------------------------------------------------------------------------------------
# RESPONSE STATE MACHINE
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_sfn_state_machine" "response" {
  name     = "${local.name_prefix}-playbook"
  role_arn = aws_iam_role.sfn_role.arn
  type     = "STANDARD"

  definition = templatefile("${path.module}/step-functions/response.asl.json", {
    IdentityLookupFunctionArn = aws_lambda_function.identity_lookup.arn
    CognitoUserPoolId         = var.cognito_user_pool_id
    SignalBusArn              = var.signal_bus_arn
  })

  logging_configuration {
    level                  = "ERROR"
    include_execution_data = true
    log_destination        = "${aws_cloudwatch_log_group.sfn_logs.arn}:*"
  }
}
