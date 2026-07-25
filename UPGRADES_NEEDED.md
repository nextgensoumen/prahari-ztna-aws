# Prahari — Upgrades & Hardening Roadmap

> This document is an honest, critical audit of the current codebase.
> Items are grouped by **severity** and **effort**. Fix all P0s before demo.
> Written by the Antigravity session that built the platform, so no sugar-coating.

---

## P0 — Must Fix Before `terraform apply`

These are bugs that will cause Terraform to fail or the platform to malfunction.

### 1. ASL `ResultSelector` uses invalid intrinsic function
**File**: `infra/modules/automated-response/step-functions/response.asl.json` (line 17)

```diff
- "cognito_username.$": "States.JsonToString($.Payload)"
+ "cognito_username.$": "States.Format('{}', $.Payload.cognito_username)"
```
`States.JsonToString` is not a valid ASL intrinsic function — it will fail validation when the state machine is created.

---

### 2. Verified Access endpoint has `null` for required ACM cert
**File**: `infra/modules/ztna-broker/verified-access.tf`

The `aws_verifiedaccess_endpoint` resource has `domain_certificate_arn = null`. Terraform will error without a real cert. **Fix**: Move this resource to a separate `verified-access-endpoint.tf` and gate it behind a `count` check that also requires `var.acm_cert_arn != ""`.

---

### 3. No `backend.tf` in `infra/envs/dev/` — state is local only
**File**: Missing `infra/envs/dev/backend.tf`

Without this, `terraform apply` stores state locally instead of the S3 remote backend we built in Step 1. The dev environment cannot be collaborative or recoverable without it.

**Fix — create `infra/envs/dev/backend.tf`**:
```hcl
terraform {
  backend "s3" {
    bucket         = "prahari-tf-state-<ACCOUNT_ID>-us-east-1"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    use_lockfile   = true
  }
}
```

---

### 4. `aws_codebuild_project` source type GITHUB requires a service connection
**File**: `infra/modules/supply-chain/main.tf`

CodeBuild with `source.type = "GITHUB"` requires an authorized GitHub connection pre-configured in your AWS account OR an `aws_codebuild_source_credential` resource. Without it, the project can be created but builds fail with an auth error.

---

## P1 — High Priority (Before Demo / Viva)

### 5. GitHub Actions workflows are empty placeholders
**Files**: `infra-plan.yml`, `infra-apply.yml`, `security-scan.yml`, `dashboard-ci.yml`

All were scaffolded as one-liners. Priority order of implementation:
- **`security-scan.yml`** — Run `tfsec`, `checkov`, `trivy`, `npm audit` on every PR
- **`infra-plan.yml`** — OIDC auth → `terraform init` → `terraform plan` on every PR
- **`infra-apply.yml`** — Manual approval environment → `terraform apply` on main merge
- **`dashboard-ci.yml`** — `npm ci` → `npm run build` → `aws s3 sync` → CloudFront invalidation

---

### 6. No `terraform.tfvars.example` — onboarding is impossible
A new contributor running `terraform plan` in `infra/envs/dev/` will get no guidance on what variables to set. Add this file.

---

### 7. Dashboard `.env.example` is missing
**Dir**: `dashboard/`

The dashboard requires 7 environment variables in `.env.local` before `npm run dev` works. Without an example committed, anyone cloning the repo is stuck.

---

### 8. Lambda Dead-Letter Queues (DLQs) are missing
**Affected**: All 7 Lambdas (normalizer, diff-bot, discovery-bot, risk-engine, identity-lookup, dashboard-api)

If a Lambda fails silently, events are dropped. This is critical for `signal-normalizer` — dropped events mean silent gaps in the findings feed.

---

### 9. CloudWatch alarms are missing
No alarms exist for Lambda error rate, DynamoDB throttles, EventBridge failed invocations, or Step Functions execution failures. Add at minimum one composite alarm per module.

---

### 10. Security Hub requires AWS Config — not documented
The `aws_securityhub_account` resource will fail with confusing errors if AWS Config is not enabled. Add a clear prerequisite note in the README.

---

## P2 — Security Hardening (Before Any Real Traffic)

### 11. API Gateway lacks WAF
No `aws_wafv2_web_acl` is configured. Add rate-based rules to prevent JWT replay attacks.

### 12. CloudFront lacks Security Headers
No `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, or `X-Content-Type-Options` headers. Add a `aws_cloudfront_response_headers_policy`.

### 13. Lambda functions have no reserved concurrency limits
A GuardDuty finding storm could scale the normalizer to thousands of concurrent invocations. Set `reserved_concurrent_executions` on high-volume Lambdas.

### 14. DynamoDB tables have no Point-in-Time Recovery (PITR)
`prahari-platform-events` and `prahari-trust-scores` have no PITR. A bad Lambda write has no recovery path. Add `point_in_time_recovery { enabled = true }` to both.

### 15. Cognito MFA is `OPTIONAL` — should be `REQUIRED` for admins
For a Zero Trust platform, admin logins without MFA is a contradiction. Add a pre-authentication Lambda trigger or enforce TOTP enrollment before group membership is granted.

---

## P3 — Completeness / Viva Readiness

### 16. `docs/architecture.md` and `docs/threat-model.md` are empty stubs
Critical for a final-year viva. Recommended:
- `architecture.md`: Mermaid diagram of all 7 modules, data flows, AWS service interactions
- `threat-model.md`: STRIDE analysis per module, attack tree for supply chain compromise, mitigations map

### 17. `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md` are stubs
All three need real content. Without them the repo looks unfinished.

### 18. No `tests/` content at all
`tests/infra/` and `tests/services/` are empty. Minimum viable:
- `tests/infra/checkov_policy.yml` — custom Checkov policy enforcing `prahari:managed` tagging
- `tests/services/test_normalizer.py` — unit tests for severity mapping in `signal-normalizer`
- `tests/services/test_risk_engine.py` — unit tests for each rule in the risk scoring table

### 19. `infra/envs/demo/` is empty
The build-order calls for a demo environment. It is currently empty. Add a copy of `dev/main.tf` with `deploy_verified_access = true` and `Environment = "demo"` — the environment you turn on for the viva and destroy immediately after.

---

## P4 — Recommended Enhancements

### 20. Risk engine: add score decay
Scores stay at maximum until 24h TTL expires. A decay of -2 points/hour with no new signals would make the trust model more accurate and defensible at a viva.

### 21. Policy diff bot: support managed policy diffing
The autopilot doesn't compare against AWS-managed policies already attached. The diff should flag when an attached managed policy is broader than the generated least-privilege policy.

### 22. Add Dependabot for `dashboard/` npm packages
A `dependabot.yml` should auto-create PRs when React/Vite dependencies have CVEs.

### 23. Supply chain: add `npm audit` and SBOM for dashboard itself
The dashboard's own npm dependencies are not included in the supply chain pipeline. Add a step to run `npm audit --audit-level=high` and generate an SBOM for the frontend bundle.

---

## Summary Table

| ID | Priority | Effort | Category | Item |
|----|----------|--------|----------|------|
| 1  | **P0** | 5 min | Bug | Fix invalid ASL intrinsic `States.JsonToString` |
| 2  | **P0** | 20 min | Bug | Gate Verified Access endpoint behind `acm_cert_arn` var |
| 3  | **P0** | 15 min | Missing | Add `backend.tf` to dev env |
| 4  | **P0** | 30 min | Config | Add CodeBuild GitHub source credential |
| 5  | **P1** | 2–3 hrs | Missing | Implement 4 GitHub Actions workflows |
| 6  | **P1** | 15 min | Missing | Add `terraform.tfvars.example` |
| 7  | **P1** | 5 min | Missing | Add `dashboard/.env.example` |
| 8  | **P1** | 1 hr | Reliability | Add DLQs to all Lambdas |
| 9  | **P1** | 1 hr | Observability | Add CloudWatch alarms per module |
| 10 | **P1** | 5 min | Docs | Document AWS Config prerequisite |
| 11 | **P2** | 1 hr | Security | Add WAF to API Gateway |
| 12 | **P2** | 30 min | Security | Add CloudFront security headers policy |
| 13 | **P2** | 15 min | Security | Add Lambda reserved concurrency limits |
| 14 | **P2** | 10 min | Reliability | Enable DynamoDB PITR on both tables |
| 15 | **P2** | 1 hr | Security | Enforce MFA for `prahari-admins` group |
| 16 | **P3** | 4–6 hrs | Docs | Fill architecture.md + threat-model.md |
| 17 | **P3** | 1 hr | Docs | Fill SECURITY.md, CONTRIBUTING.md, CHANGELOG.md |
| 18 | **P3** | 3–4 hrs | Testing | Add unit tests for normalizer + risk engine |
| 19 | **P3** | 20 min | Completeness | Add `infra/envs/demo/` |
| 20 | **P4** | 1 hr | Enhancement | Score decay in risk engine |
| 21 | **P4** | 2 hrs | Enhancement | Managed policy diffing in policy-diff-bot |
| 22 | **P4** | 10 min | Maintenance | Add Dependabot |
| 23 | **P4** | 1 hr | Security | npm audit + frontend SBOM in supply chain |

**Fix P0 today. Fix P1 before viva. P2–P4 based on time available.**
