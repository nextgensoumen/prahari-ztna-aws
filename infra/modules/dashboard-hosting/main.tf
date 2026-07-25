data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix = "prahari-dashboard"
}

# ---------------------------------------------------------------------------------------------------------------------
# COGNITO SPA CLIENT (PKCE, no secret)
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_cognito_user_pool_client" "dashboard" {
  name         = "${local.name_prefix}-spa-client"
  user_pool_id = var.cognito_user_pool_id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  # Will be updated after CloudFront URL is known
  callback_urls = [
    "http://localhost:5173/callback",
    "https://${aws_cloudfront_distribution.dashboard.domain_name}/callback"
  ]
  logout_urls = [
    "http://localhost:5173",
    "https://${aws_cloudfront_distribution.dashboard.domain_name}"
  ]

  supported_identity_providers = ["COGNITO"]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 24

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "hours"
  }

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  prevent_user_existence_errors = "ENABLED"
}

# ---------------------------------------------------------------------------------------------------------------------
# S3 STATIC SITE BUCKET
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_s3_bucket" "dashboard" {
  bucket        = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "dashboard" {
  bucket                  = aws_s3_bucket.dashboard.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id
  versioning_configuration { status = "Enabled" }
}

# ---------------------------------------------------------------------------------------------------------------------
# CLOUDFRONT OAC + DISTRIBUTION
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "dashboard" {
  name                              = "${local.name_prefix}-oac"
  description                       = "OAC for Prahari Dashboard S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${local.name_prefix}-security-headers"
  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self' 'unsafe-inline' https://*.amazoncognito.com https://*.amazonaws.com;"
      override                = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    content_type_options {
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "dashboard" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "Prahari ZTNA Dashboard"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.dashboard.bucket_regional_domain_name
    origin_id                = "s3-dashboard"
    origin_access_control_id = aws_cloudfront_origin_access_control.dashboard.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-dashboard"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA routing: all 404s return index.html
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Allow CloudFront to read from S3
resource "aws_s3_bucket_policy" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontServicePrincipal"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.dashboard.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.dashboard.arn
        }
      }
    }]
  })
}

# ---------------------------------------------------------------------------------------------------------------------
# API GATEWAY + COGNITO JWT AUTHORIZER
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_api_gateway_rest_api" "main" {
  name        = "${local.name_prefix}-api"
  description = "Prahari Dashboard API — backed by Lambda, authorized by Cognito"
}

resource "aws_api_gateway_authorizer" "cognito" {
  name            = "cognito-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.main.id
  type            = "COGNITO_USER_POOLS"
  identity_source = "method.request.header.Authorization"
  provider_arns   = [var.cognito_user_pool_arn]
}

# Proxy all requests to the Lambda
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# CORS OPTIONS method (no auth)
resource "aws_api_gateway_method" "options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_200" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = aws_api_gateway_method_response.options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  depends_on = [
    aws_api_gateway_integration.lambda,
    aws_api_gateway_integration.options
  ]
  lifecycle { create_before_destroy = true }
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = "v1"
}

# ---------------------------------------------------------------------------------------------------------------------
# DASHBOARD API LAMBDA
# ---------------------------------------------------------------------------------------------------------------------
data "aws_iam_policy_document" "api_lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_lambda" {
  name               = "${local.name_prefix}-api-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.api_lambda_trust.json
}

data "aws_iam_policy_document" "api_lambda_permissions" {
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
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = [
      var.events_table_arn,
      "${var.events_table_arn}/index/*"
    ]
  }

  statement {
    sid    = "ReadTrustScores"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Scan"
    ]
    resources = [var.trust_scores_table_arn]
  }

  statement {
    sid    = "StartResponsePlaybook"
    effect = "Allow"
    actions = [
      "states:StartExecution"
    ]
    resources = [var.response_state_machine_arn]
  }
}

resource "aws_iam_role_policy" "api_lambda" {
  name   = "${local.name_prefix}-api-lambda-policy"
  role   = aws_iam_role.api_lambda.id
  policy = data.aws_iam_policy_document.api_lambda_permissions.json
}

data "archive_file" "api_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../services/dashboard-api/src/main.py"
  output_path = "${path.module}/dashboard-api.zip"
}

resource "aws_lambda_function" "api" {
  filename         = data.archive_file.api_zip.output_path
  function_name    = "${local.name_prefix}-api"
  role             = aws_iam_role.api_lambda.arn
  handler          = "main.lambda_handler"
  runtime          = "python3.12"
  timeout          = 30
  source_code_hash = data.archive_file.api_zip.output_base64sha256

  environment {
    variables = {
      EVENTS_TABLE_NAME         = var.events_table_name
      TRUST_SCORES_TABLE_NAME   = var.trust_scores_table_name
      RESPONSE_STATE_MACHINE_ARN = var.response_state_machine_arn
      GITHUB_REPO               = var.github_repo
      ALLOWED_ORIGIN            = "https://${aws_cloudfront_distribution.dashboard.domain_name}"
    }
  }
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# ---------------------------------------------------------------------------------------------------------------------
# WAFv2 FOR API GATEWAY
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_wafv2_web_acl" "api" {
  name        = "${local.name_prefix}-api-waf"
  description = "WAF for Prahari Dashboard API"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWS-AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimit"
    priority = 2
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 500
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-api-waf"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "api" {
  resource_arn = aws_api_gateway_stage.main.arn
  web_acl_arn  = aws_wafv2_web_acl.api.arn
}
