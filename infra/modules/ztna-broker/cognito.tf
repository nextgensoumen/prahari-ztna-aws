data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  name_prefix = "prahari"
}

# ---------------------------------------------------------------------------------------------------------------------
# COGNITO USER POOL — single identity plane for ZTNA broker AND dashboard
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  auto_verified_attributes = ["email"]

  username_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false
    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${local.name_prefix}-auth-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# OAuth2 scopes that the Verified Access trust provider will inspect
resource "aws_cognito_resource_server" "platform" {
  identifier   = "https://prahari.platform"
  name         = "Prahari Platform"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "admin"
    scope_description = "Full admin access to the Prahari platform"
  }

  scope {
    scope_name        = "user"
    scope_description = "Standard user access to allowed applications"
  }
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "${local.name_prefix}-broker-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes = [
    "openid",
    "email",
    "profile",
    "${aws_cognito_resource_server.platform.identifier}/admin",
    "${aws_cognito_resource_server.platform.identifier}/user"
  ]

  # Placeholder callback URL — update when you have a real app URL
  callback_urls = ["https://placeholder.example.com/callback"]
  logout_urls   = ["https://placeholder.example.com/logout"]

  supported_identity_providers = ["COGNITO"]

  access_token_validity  = 60   # minutes
  id_token_validity      = 60   # minutes
  refresh_token_validity = 24   # hours

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "hours"
  }

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# User groups — mapped to Cedar policies
resource "aws_cognito_user_group" "admins" {
  name         = "prahari-admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Platform administrators: full access to findings, policies, sessions"
  precedence   = 1
}

resource "aws_cognito_user_group" "users" {
  name         = "prahari-users"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Standard users: access to own sessions, trust score, and allowed apps"
  precedence   = 10
}
