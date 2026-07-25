# Session 01 — Scaffolding, State Backend, Supply Chain & Autopilot
Date: 2026-07-25
Module/phase touched: Project Scaffolding, State Backend, Supply Chain, Least-Privilege Autopilot
What changed:
- Established the exact directory structure, gitignore, and boilerplate files.
- Built the S3/DynamoDB state backend Terraform module.
- Built the `supply-chain` module and `supply-chain-gate.yml` workflow, utilizing an OIDC-authenticated AWS CodeBuild pipeline for Docker image building, Syft SBOM generation, and keyless Cosign signature/attestation without static credentials.
- Built the `least-priv-autopilot` module, utilizing EventBridge, Step Functions, Access Analyzer, and a Python Lambda (`policy-diff-bot`) to generate GitOps PRs that propose tightened IAM policies based on actual CloudTrail usage.
Why (the reasoning, not just the diff):
- The state backend ensures remote state for IaC is securely versioned and locked.
- The supply chain leverages OIDC and keyless Sigstore to ensure that artifacts can be built and cryptographically verified in GitHub Actions before deployment, adhering to the "no static credentials" and "pipeline gate" constraints.
- The autopilot strictly filters by `prahari:managed = true` to protect unrelated infrastructure, and delegates the final application of the IAM policy to a human via GitOps (PR), completely eliminating automatic control-plane mutations.
Files touched:
- Project root files (`README.md`, `.gitignore`, `LICENSE`, etc.)
- `.github/workflows/` (Supply chain gate and placeholders)
- `infra/global/state-backend/*`
- `infra/modules/supply-chain/*`
- `infra/modules/least-priv-autopilot/*`
- `services/policy-diff-bot/src/*`
Open questions / next step:
- Step 4: Building the `signal-bus` module.
