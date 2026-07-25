output "response_state_machine_arn" {
  description = "ARN of the automated response Step Functions state machine"
  value       = aws_sfn_state_machine.response.arn
}
