# Threat Model

This document outlines the threat model for the Prahari platform, applying the STRIDE methodology to the core components.

## STRIDE Analysis

| Threat | Description | Mitigation in Prahari |
|--------|-------------|-----------------------|
| **Spoofing** | An attacker impersonates a valid user or service. | All authentication goes through Cognito (OIDC). Machine identities use IAM roles with restricted trust policies. GitHub Actions uses OIDC instead of long-lived access keys. |
| **Tampering** | An attacker modifies code or infrastructure state. | All infrastructure is managed via Terraform state in an S3 bucket with versioning and locking. Docker images are immutable and signed via Sigstore keyless signing. |
| **Repudiation** | An attacker performs an action and denies it. | CloudTrail is enabled globally and logs are shipped to an immutable S3 bucket. All security events are normalized and stored in DynamoDB for auditing. |
| **Information Disclosure** | Sensitive data is exposed. | All S3 buckets block public access. Traffic is encrypted in transit (TLS 1.2+ via CloudFront/API Gateway/Verified Access). DynamoDB and S3 use SSE-KMS. |
| **Denial of Service** | An attacker floods the system to degrade availability. | Serverless architecture (API Gateway, Lambda, CloudFront) absorbs volumetric attacks. API Gateway uses rate limiting. |
| **Elevation of Privilege** | An attacker gains admin rights. | Step Functions response playbook is strictly scoped to attach `AWSDenyAll` only. IAM Autopilot enforces least-privilege policies. |

## Attack Trees

### Scenario: Supply Chain Compromise

An attacker attempts to deploy malicious code to the protected application.

1. **Goal: Deploy malicious container**
   - **Path A: Compromise GitHub Repo**
     - *Mitigation*: Branch protection rules, required reviews, `security-scan.yml` enforcing Trivy/tfsec.
   - **Path B: Steal AWS Credentials**
     - *Mitigation*: GitHub OIDC is used; no long-lived AWS keys exist. CodeBuild role is scoped specifically to the ECR repo.
   - **Path C: Bypass ECR Image Scanning**
     - *Mitigation*: ECR is configured for `scan_on_push = true`.
   - **Path D: Deploy Unsigned Image**
     - *Mitigation*: Sigstore keyless signing is enforced. Verified Access / EKS admission controllers (Step 8) reject unsigned artifacts.
