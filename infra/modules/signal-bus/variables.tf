variable "retention_in_days" {
  description = "Number of days to retain CloudTrail logs in S3 and CloudWatch"
  type        = number
  default     = 90
}
