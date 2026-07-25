# Session 04 — Automated Response: Step Functions Playbooks
Date: 2026-07-25
Module/phase touched: automated-response, services/response-playbooks
What changed:
- Created the identity lookup Lambda (`identity_lookup.py`): resolves an IAM principal ARN to a Cognito username via the trust-scores DynamoDB table. Returns `skip_revocation=true` for headless service roles with no Cognito identity.
- Created the response ASL (`response.asl.json`) with two paths:
  - FullResponse (parallel): Branch A revokes Cognito session (`AdminUserGlobalSignOut`), Branch B attaches `AWSDenyAll` and tags the role `prahari:quarantined = true`.
  - QuarantineOnly: for headless roles — skips session revocation, still quarantines the IAM role.
- Both paths emit custom events (`SessionRevoked`, `RoleQuarantined`) back to `prahari-signal-bus` so the dashboard can surface them.
- Created the Step Functions state machine with CloudWatch logging at ERROR level.
- Created two EventBridge trigger rules: (1) `RiskScoreUpdated[is_high_risk=true]` on the prahari-signal-bus, (2) GuardDuty findings with severity >= 7 on the default bus (fast-path bypassing risk engine for very high confidence signals).
- Added `trust_scores_table_arn` output to the `ztna-broker` module to satisfy the new input dependency.
Why (the reasoning, not just the diff):
- Parallel branches mean session revocation and IAM quarantine happen simultaneously — total response time is bounded by the slower branch, not the sum of both.
- `AWSDenyAll` attachment is reversible: a human detaches the policy to restore access, which is a deliberate human-in-the-loop gate for recovery. This aligns with the explainability constraint — no automated de-quarantine.
- The fast-path GuardDuty rule (severity >= 7) bypasses the risk engine for undeniably high-confidence signals. A GuardDuty 9.0 severity finding shouldn't wait for the risk engine to query DynamoDB.
- The IAM `AttachRolePolicy` is conditioned on `iam:PolicyARN = AWSDenyAll` only — the state machine role cannot attach any other policy, eliminating the possibility of privilege escalation via the response mechanism itself.
Files touched:
- `infra/modules/automated-response/main.tf`
- `infra/modules/automated-response/lambda.tf`
- `infra/modules/automated-response/playbooks.tf`
- `infra/modules/automated-response/variables.tf`
- `infra/modules/automated-response/outputs.tf`
- `infra/modules/automated-response/step-functions/response.asl.json`
- `services/response-playbooks/src/identity_lookup.py`
- `infra/modules/ztna-broker/outputs.tf` (added trust_scores_table_arn)
- `infra/envs/dev/main.tf` (added automated_response module block and output)
Open questions / next step:
- Step 7: `dashboard-hosting` module + React app + `dashboard-api` service. This is the final major module and will wire Cognito auth directly to the dashboard.
