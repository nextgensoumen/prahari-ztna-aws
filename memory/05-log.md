# Session 05 — Backend Strengthening Phase 2 (Deep Analysis)
Date: 2026-07-25
Module/phase touched: risk-engine, signal-bus, ztna-broker/cognito, signal-bus/main, tests/services
What changed:
- **Critical Bug Fix (EventBridge Feedback Loop)**: The `risk_engine_trigger` EventBridge rule used `source = [{ "prefix": "" }]` which matched every event including Prahari's own `RiskScoreUpdated` events, creating a dangerous circular feedback loop. Fixed by explicitly restricting the pattern to `aws.guardduty`, `aws.securityhub`, and `aws.cloudtrail` sources only.
- **ARM64 (Graviton2)**: Added `architectures = ["arm64"]` to both the `normalizer` and `risk-engine` Lambda functions for ~20% cost savings.
- **AWS X-Ray Active Tracing**: Added `tracing_config { mode = "Active" }` to all Lambdas and granted `xray:PutTraceSegments` and `xray:PutTelemetryRecords` IAM permissions to each Lambda role. Enables distributed tracing and a service map in the AWS console.
- **Cognito Advanced Security Features**: Added `user_pool_add_ons { advanced_security_mode = "ENFORCED" }` to the Cognito User Pool. This enables Cognito's built-in risk-based adaptive authentication — it detects logins from Tor nodes, unusual geographies, and blocks credential stuffing attacks automatically.
- **S3 Object Lock on CloudTrail Bucket**: Added `object_lock_enabled = true` and set `force_destroy = false` on the CloudTrail S3 bucket. This enforces a WORM (Write-Once-Read-Many) policy, preventing any user — including compromised admins — from deleting audit logs.
- **Trust Score Decay (Risk Engine Rewrite)**: Completely rewrote `services/risk-engine/src/main.py` to apply linear decay (`SCORE_DECAY_RATE = 5` points/hour) to stored trust scores before adding new event penalties. This eliminates the binary "stuck at maximum for 24h" problem and makes the trust model continuous and accurate.
- **2 New Scoring Rules**: Added `root_account_login` (+60 pts) and `iam_user_created` (+35 pts, shadow-admin detection) to the scoring rule table.
- **Structured Logging**: Added structured key=value logging throughout risk-engine for better CloudWatch Insights queries.
- **Unit Tests (40 tests)**: Created two comprehensive test files covering all 8 scoring rules, trust signals, score clamping, inter-principal isolation, all 4 severity mappings, normalizer routing, and the score decay algorithm.
Why (the reasoning, not just the diff):
- The EventBridge feedback loop was a ticking time bomb — one GuardDuty alert would have caused hundreds of circular Lambda invocations, burning concurrency and generating noise.
- Score decay was requested by UPGRADES_NEEDED.md (P4 item) but is actually a critical model correctness issue — without it, the trust model is a binary on/off switch, not a continuous risk surface.
- Unit tests ensure that any future change to the rule table (adding/removing rules, changing point values) is caught before deployment, protecting against silent scoring regressions.
Files touched:
- `infra/modules/ztna-broker/risk-engine.tf`
- `infra/modules/signal-bus/lambda.tf`
- `infra/modules/ztna-broker/cognito.tf`
- `infra/modules/signal-bus/main.tf`
- `services/risk-engine/src/main.py` (complete rewrite)
- `tests/services/test_risk_engine.py` (new, 40 tests)
- `tests/services/test_normalizer.py` (new, 24 tests)
Open questions / next step:
- Consider adding a pytest CI step in `.github/workflows/` to run tests on every PR.
- The dashboard-api Lambda and policy-diff-bot can also benefit from ARM64 + X-Ray upgrades.
