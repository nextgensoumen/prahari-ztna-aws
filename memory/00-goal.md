# Prahari: Zero Trust Access & Governance

## Purpose and Scope
Prahari (prahari-ztna-aws) is an open-source, production-ready Zero Trust Access & Governance platform for AWS. It combines AWS-native Zero Trust services into one cohesive platform.

## Architectural Tiers
1. **Supply chain pipeline**: CodePipeline/CodeBuild/ECR, OIDC federation (no long-lived AWS keys), SBOM generation, artifact signing (cosign/Sigstore), and a policy gate that blocks unsigned/unverified deploys.
2. **Least-privilege autopilot**: CloudTrail + IAM Access Analyzer policy generation, wrapped in a GitOps loop that opens a pull request with a tightened IAM policy instead of auto-applying it.
3. **Security signal bus**: CloudTrail, EventBridge, Security Hub, GuardDuty, Detective. The shared telemetry layer everything else reads from.
4. **Adaptive ZTNA broker**: AWS Verified Access + Verified Permissions (Cedar policies) + Cognito. A deterministic, rule-based risk-scoring Lambda (NOT machine learning — a weighted rule table) adjusts session policy in real time.
5. **Automated response**: Step Functions playbooks triggered by GuardDuty/Security Hub findings, which can revoke a Verified Access session or quarantine an IAM principal.
6. **Zero Trust EKS (optional/stretch)**: SPIFFE/SPIRE, service mesh (Istio/Linkerd), OPA/Gatekeeper or Kyverno admission policies, EKS with Fargate profiles.
7. **Web dashboard**: React app + API Gateway/Lambda backend + DynamoDB, gated by the same Cognito user pool the ZTNA broker uses. Two roles via Cognito groups: Admins and Users.

## Hard Constraints
- **No AI/ML anywhere in the platform logic**: Every "smart" decision must be deterministic and explainable (rule tables, thresholds, boolean correlation logic).
- **Infrastructure as Code only**: Every AWS resource is declared in Terraform (AWS provider). No console click-ops, no CloudFormation.
- **No root account usage, ever**: Local Terraform runs use IAM Identity Center SSO credentials. CI authenticates via IAM OIDC federation — no static AWS access keys.
- **Cost-aware by design**: Verified Access and Network Firewall bill per hour — do not design anything that assumes it stays on 24/7. The demo environment must be fully destroyable and recreatable.
- **Least privilege everywhere**: Every Lambda/service gets its own narrowly scoped IAM role.
- **One identity plane**: Cognito is the single source of identity for both the ZTNA broker and the dashboard.

## Build Order
1. `infra/global/state-backend` + `infra/envs/dev` skeleton
2. `supply-chain` module
3. `least-priv-autopilot` module
4. `signal-bus` module
5. `ztna-broker` module + the `risk-engine` service
6. `automated-response` module
7. `dashboard-hosting` module + the React app + `dashboard-api` service
8. `zt-eks` module (optional stretch goal)
