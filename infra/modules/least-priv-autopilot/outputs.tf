output "state_machine_arn" {
  description = "ARN of the Step Functions State Machine"
  value       = aws_sfn_state_machine.autopilot.arn
}

output "github_token_secret_arn" {
  description = "ARN of the Secrets Manager secret for the GitHub token"
  value       = aws_secretsmanager_secret.github_token.arn
}
