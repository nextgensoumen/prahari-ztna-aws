output "cloudfront_domain" {
  description = "CloudFront distribution domain name (dashboard URL)"
  value       = aws_cloudfront_distribution.dashboard.domain_name
}

output "api_gateway_url" {
  description = "API Gateway URL for the dashboard backend"
  value       = "${aws_api_gateway_stage.main.invoke_url}"
}

output "dashboard_bucket_name" {
  description = "S3 bucket name for the dashboard static assets"
  value       = aws_s3_bucket.dashboard.id
}

output "cognito_dashboard_client_id" {
  description = "Cognito App Client ID for the dashboard SPA"
  value       = aws_cognito_user_pool_client.dashboard.id
}
