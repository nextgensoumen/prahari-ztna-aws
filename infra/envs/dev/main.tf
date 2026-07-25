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

module "ztna_broker" {
  source = "../../modules/ztna-broker"

  signal_bus_arn    = module.signal_bus.signal_bus_arn
  events_table_name = module.signal_bus.events_table_name

  deploy_verified_access = false
  risk_score_threshold   = 50
}

module "automated_response" {
  source = "../../modules/automated-response"

  cognito_user_pool_id    = module.ztna_broker.cognito_user_pool_id
  cognito_user_pool_arn   = module.ztna_broker.cognito_user_pool_arn
  signal_bus_arn          = module.signal_bus.signal_bus_arn
  trust_scores_table_name = module.ztna_broker.trust_scores_table_name
  trust_scores_table_arn  = module.ztna_broker.trust_scores_table_arn
}

module "dashboard_hosting" {
  source = "../../modules/dashboard-hosting"

  cognito_user_pool_id       = module.ztna_broker.cognito_user_pool_id
  cognito_user_pool_arn      = module.ztna_broker.cognito_user_pool_arn
  events_table_name          = module.signal_bus.events_table_name
  events_table_arn           = module.signal_bus.events_table_arn
  trust_scores_table_name    = module.ztna_broker.trust_scores_table_name
  trust_scores_table_arn     = module.ztna_broker.trust_scores_table_arn
  response_state_machine_arn = module.automated_response.response_state_machine_arn
  github_repo                = "nextgensoumen/prahari-ztna-aws"
}

# ─── Outputs ──────────────────────────────────────────────────────────────────
output "supply_chain_role_arn" {
  value = module.supply_chain.github_actions_role_arn
}
output "autopilot_state_machine_arn" {
  value = module.least_priv_autopilot.state_machine_arn
}
output "signal_bus_arn" {
  value = module.signal_bus.signal_bus_arn
}
output "events_table_name" {
  value = module.signal_bus.events_table_name
}
output "cognito_user_pool_id" {
  value = module.ztna_broker.cognito_user_pool_id
}
output "cognito_client_id" {
  value = module.ztna_broker.cognito_client_id
}
output "trust_scores_table_name" {
  value = module.ztna_broker.trust_scores_table_name
}
output "response_state_machine_arn" {
  value = module.automated_response.response_state_machine_arn
}
output "dashboard_url" {
  value       = "https://${module.dashboard_hosting.cloudfront_domain}"
  description = "Prahari Dashboard — visit this URL after deploy"
}
output "api_gateway_url" {
  value = module.dashboard_hosting.api_gateway_url
}
output "cognito_dashboard_client_id" {
  value = module.dashboard_hosting.cognito_dashboard_client_id
}
