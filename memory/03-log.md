# Session 03 — ZTNA Broker: Cognito, Cedar, Verified Access + Risk Engine
Date: 2026-07-25
Module/phase touched: ztna-broker, services/risk-engine
What changed:
- Created the Cognito User Pool (`prahari-users`) as the single identity plane for both ZTNA broker and dashboard. Configured MFA (OPTIONAL), 12-char password policy, email verification, and admin-only user creation.
- Added Cognito Hosted UI domain, a resource server with `platform/admin` and `platform/user` OAuth2 scopes, and an OIDC app client.
- Created two Cognito user groups: `prahari-admins` (precedence 1) and `prahari-users` (precedence 10).
- Created the Verified Permissions (Cedar) policy store with a strict schema defining `User`, `Group`, and `Application` entity types.
- Wrote three Cedar policies: admins can access all resources, users can only access `user-portal`, and an explicit `forbid` when `trust_score > threshold`.
- Created the Verified Access instance, OIDC trust provider (linked to Cognito), access group, and endpoint — all gated behind `var.deploy_verified_access = false` to avoid per-hour billing unless explicitly enabled.
- Built the `risk-engine` Lambda (Python) using a deterministic weighted rule table. No ML anywhere. Scoring: GuardDuty critical +50, high +30; CloudTrail privilege escalation +25; audit trail tampering +40; unusual login +20; Security Hub high/critical +20; MFA login -20. Score clamped to [0, 100].
- Created the `prahari-trust-scores` DynamoDB table with 24h TTL on each score record.
- Wired the risk engine to `prahari-signal-bus` via an EventBridge rule so every normalized event triggers a score recalculation.
- Risk engine emits a `RiskScoreUpdated` custom event back to `prahari-signal-bus` for the automated-response module to consume next.
Why (the reasoning, not just the diff):
- The Cedar `forbid` policy is critical: it means even a legitimate group member gets denied if their computed risk score exceeds the threshold. This is the Zero Trust "never trust, always verify" principle implemented as a deterministic policy, not ML.
- Verified Access is cost-gated by default because it bills per endpoint per hour. This satisfies the cost-aware constraint while still allowing a real live demo when needed.
- One Cognito pool for everything prevents identity fragmentation — the same token that lets a user into the ZTNA broker also authenticates them to the dashboard API.
- The risk engine writes scores with a 24h TTL so stale threat context automatically expires and doesn't permanently penalize legitimate users.
Files touched:
- `infra/modules/ztna-broker/cognito.tf`
- `infra/modules/ztna-broker/cedar.tf`
- `infra/modules/ztna-broker/verified-access.tf`
- `infra/modules/ztna-broker/risk-engine.tf`
- `infra/modules/ztna-broker/variables.tf`
- `infra/modules/ztna-broker/outputs.tf`
- `services/risk-engine/src/main.py`
- `infra/envs/dev/main.tf` (added ztna_broker module block and outputs)
Open questions / next step:
- Verified Access endpoint requires an ACM cert ARN and a real load balancer. These are placeholders until Step 7 (dashboard-hosting) brings up a real ALB.
- Step 6: `automated-response` module — Step Functions playbooks that revoke Verified Access sessions and quarantine IAM principals, triggered by `RiskScoreUpdated` events.
