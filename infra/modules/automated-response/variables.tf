variable "cognito_user_pool_id" {
  description = "ID of the Prahari Cognito User Pool"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "ARN of the Prahari Cognito User Pool"
  type        = string
}

variable "signal_bus_arn" {
  description = "ARN of the prahari-signal-bus custom EventBridge bus"
  type        = string
}

variable "trust_scores_table_name" {
  description = "Name of the prahari-trust-scores DynamoDB table"
  type        = string
}

variable "trust_scores_table_arn" {
  description = "ARN of the prahari-trust-scores DynamoDB table"
  type        = string
}
