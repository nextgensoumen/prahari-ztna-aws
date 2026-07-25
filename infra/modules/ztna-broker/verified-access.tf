# ---------------------------------------------------------------------------------------------------------------------
# VERIFIED ACCESS — gated by var.deploy_verified_access
# ⚠️  COST ALERT: These resources bill per-hour. Run 'terraform destroy' when done with a demo.
# Set deploy_verified_access = true only when demonstrating the broker live.
# ---------------------------------------------------------------------------------------------------------------------

resource "aws_verifiedaccess_instance" "main" {
  count       = var.deploy_verified_access ? 1 : 0
  description = "Prahari ZTNA Verified Access Instance"
}

resource "aws_verifiedaccess_trust_provider" "cognito" {
  count                    = var.deploy_verified_access ? 1 : 0
  trust_provider_type      = "user"
  user_trust_provider_type = "oidc"
  description              = "Prahari Cognito OIDC trust provider"
  policy_reference_name    = "cognito"

  oidc_options {
    issuer                 = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}"
    authorization_endpoint = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/authorize"
    token_endpoint         = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/token"
    user_info_endpoint     = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/userInfo"
    client_id              = aws_cognito_user_pool_client.main.id
    client_secret          = aws_cognito_user_pool_client.main.client_secret
    scope                  = "openid email profile"
  }
}

resource "aws_verifiedaccess_instance_trust_provider_attachment" "main" {
  count                       = var.deploy_verified_access ? 1 : 0
  verifiedaccess_instance_id      = aws_verifiedaccess_instance.main[0].id
  verifiedaccess_trust_provider_id = aws_verifiedaccess_trust_provider.cognito[0].id
}

resource "aws_verifiedaccess_group" "main" {
  count                      = var.deploy_verified_access ? 1 : 0
  verifiedaccess_instance_id = aws_verifiedaccess_instance.main[0].id
  description                = "Prahari default access group"

  # Cedar policy: inspect Cognito group claim, enforce Cedar policy store
  policy_document = <<-CEDAR
    permit(
      principal,
      action == AWS::VerifiedAccess::Action::"Allow",
      resource
    ) when {
      context.cognito.groups.contains("prahari-admins") ||
      context.cognito.groups.contains("prahari-users")
    };
  CEDAR

  depends_on = [aws_verifiedaccess_instance_trust_provider_attachment.main]
}

resource "aws_verifiedaccess_endpoint" "app" {
  count                        = var.deploy_verified_access ? 1 : 0
  application_domain           = replace(var.app_endpoint_url, "https://", "")
  attachment_type              = "vpc"
  description                  = "Prahari protected application endpoint"
  domain_certificate_arn       = null  # Provide your ACM cert ARN here
  endpoint_domain_prefix       = "prahari-app"
  endpoint_type                = "load-balancer"
  verifiedaccess_group_id      = aws_verifiedaccess_group.main[0].id
  application_domain_certificate_arn = null  # Provide your ACM cert ARN here

  lifecycle {
    ignore_changes = [domain_certificate_arn, application_domain_certificate_arn]
  }
}
