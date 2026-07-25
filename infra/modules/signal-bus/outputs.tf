output "signal_bus_arn" {
  description = "ARN of the custom EventBridge bus for Prahari events"
  value       = aws_cloudwatch_event_bus.prahari.arn
}

output "events_table_name" {
  description = "Name of the DynamoDB table storing normalized events"
  value       = aws_dynamodb_table.events.name
}

output "kms_key_arn" {
  description = "ARN of the shared KMS key"
  value       = aws_kms_key.main.arn
}
