# Session 02 — Signal Bus: Normalized Telemetry Layer
Date: 2026-07-25
Module/phase touched: signal-bus, services/signal-normalizer
What changed:
- Provisioned a shared KMS key with a CloudTrail/CloudWatch/DynamoDB-aware key policy.
- Created the CloudTrail S3 bucket (versioned, SSE-KMS, public access blocked, 90-day lifecycle) with the required bucket ACL policy for CloudTrail writes.
- Enabled a multi-region CloudTrail with log file validation, KMS encryption, and near-real-time CloudWatch Logs delivery via a dedicated IAM role.
- Enabled GuardDuty with FIFTEEN_MINUTES finding publish frequency.
- Enabled Security Hub and subscribed to the AWS Foundational Security Best Practices v1.0.0 standard.
- Created the `prahari-platform-events` DynamoDB table (PAY_PER_REQUEST, SSE-KMS) with a GSI on `severity + timestamp` for dashboard queries.
- Created the custom `prahari-signal-bus` EventBridge bus with a catch-all rule routing all Prahari module events to the normalizer Lambda.
- Created three EventBridge rules on the DEFAULT bus: GuardDuty findings, Security Hub findings, and five high-signal CloudTrail event names (ConsoleLogin, AttachRolePolicy, PutRolePolicy, StopLogging, DeleteTrail).
- Implemented the `signal-normalizer` Python Lambda that maps all three source schemas into one common internal schema.
Why (the reasoning, not just the diff):
- The central goal of this module is schema normalization — every later consumer (dashboard, automated-response) reads ONE schema from DynamoDB instead of needing to know GuardDuty vs. Security Hub JSON structure. This is the "shared bus" principle.
- GuardDuty severity is a 0–10 float; Security Hub uses a label (LOW/MEDIUM/HIGH/CRITICAL). The normalizer converts both to a consistent low/medium/high/critical string enum.
- The CloudTrail event filter is intentionally narrow — only 5 event names that represent true privilege escalation or audit-trail tampering signals, not all API calls. This avoids Lambda invocation spam.
- The 90-day S3 lifecycle is a deliberate cost-control decision: raw logs expire, but normalized rows in DynamoDB are the long-term record.
- GuardDuty and CloudWatch Logs CloudTrail both have always-on per-event costs. GuardDuty in particular bills based on volume of data analyzed. This is flagged as a meaningful ongoing cost.
Files touched:
- `infra/modules/signal-bus/main.tf`
- `infra/modules/signal-bus/eventbridge.tf`
- `infra/modules/signal-bus/lambda.tf`
- `infra/modules/signal-bus/variables.tf`
- `infra/modules/signal-bus/outputs.tf`
- `services/signal-normalizer/src/main.py`
- `infra/envs/dev/main.tf` (added signal_bus module block and outputs)
Open questions / next step:
- Security Hub requires AWS Config to be enabled as a prerequisite — verify this in the target account before `terraform apply`.
- Step 5: `ztna-broker` module + `risk-engine` service (Verified Access + Verified Permissions + Cognito + deterministic risk scoring Lambda).
