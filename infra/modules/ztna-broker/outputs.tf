output "cognito_user_pool_id" {
  description = "ID of the Prahari Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "ARN of the Prahari Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "The Cognito hosted UI domain prefix"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "policy_store_id" {
  description = "ID of the Verified Permissions (Cedar) policy store"
  value       = aws_verifiedpermissions_policy_store.main.policy_store_id
}

output "trust_scores_table_name" {
  description = "Name of the DynamoDB trust scores table"
  value       = aws_dynamodb_table.trust_scores.name
}
