variable "deploy_verified_access" {
  description = "Set to true only when running a demo. Verified Access bills per-hour per endpoint (~$0.027/hr). Run 'terraform destroy' when done."
  type        = bool
  default     = false
}

variable "app_endpoint_url" {
  description = "HTTPS URL of the backend application protected by Verified Access"
  type        = string
  default     = "https://placeholder.example.com"
}

variable "risk_score_threshold" {
  description = "Trust score threshold (0-100) above which a session is considered high-risk"
  type        = number
  default     = 50
}

variable "signal_bus_arn" {
  description = "ARN of the prahari-signal-bus EventBridge custom event bus (from signal-bus module output)"
  type        = string
}

variable "events_table_name" {
  description = "Name of the prahari-platform-events DynamoDB table (from signal-bus module output)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate in us-east-1 for the Verified Access endpoint"
  type        = string
  default     = ""
}
