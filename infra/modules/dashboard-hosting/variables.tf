variable "cognito_user_pool_id" {
  description = "ID of the Prahari Cognito User Pool"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "ARN of the Prahari Cognito User Pool"
  type        = string
}

variable "events_table_name" {
  description = "Name of the prahari-platform-events DynamoDB table"
  type        = string
}

variable "events_table_arn" {
  description = "ARN of the prahari-platform-events DynamoDB table"
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

variable "response_state_machine_arn" {
  description = "ARN of the automated response Step Functions state machine"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository in the format org/repo"
  type        = string
  default     = "nextgensoumen/prahari-ztna-aws"
}
