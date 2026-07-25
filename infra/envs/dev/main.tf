terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "prahari-ztna-aws"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

module "supply_chain" {
  source      = "../../modules/supply-chain"
  github_repo = "nextgensoumen/prahari-ztna-aws"
}

module "least_priv_autopilot" {
  source      = "../../modules/least-priv-autopilot"
  github_repo = "nextgensoumen/prahari-ztna-aws"
}

module "signal_bus" {
  source = "../../modules/signal-bus"
}

output "supply_chain_role_arn" {
  value       = module.supply_chain.github_actions_role_arn
  description = "Add this ARN to GitHub Secrets as AWS_ROLE_ARN"
}

output "autopilot_state_machine_arn" {
  value       = module.least_priv_autopilot.state_machine_arn
  description = "ARN of the Autopilot State Machine"
}

output "signal_bus_arn" {
  value       = module.signal_bus.signal_bus_arn
  description = "ARN of the custom Prahari EventBridge bus"
}

output "events_table_name" {
  value       = module.signal_bus.events_table_name
  description = "DynamoDB table name for normalized events"
}
