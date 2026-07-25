<div align="center">
  <img src="https://img.shields.io/badge/AWS-Serverless-FF9900?logo=amazonaws&logoColor=white" alt="AWS Serverless" />
  <img src="https://img.shields.io/badge/Terraform-1.5+-7B42BC?logo=terraform&logoColor=white" alt="Terraform" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Security-Zero_Trust-4ADE80" alt="Zero Trust" />
  
  <h1 align="center">प Prahari — Zero Trust Access & Governance</h1>
  <p align="center">
    <strong>A production-grade, event-driven Zero Trust Network Access (ZTNA) platform built entirely on AWS.</strong>
  </p>
</div>

## 📖 Overview

**Prahari** (Sanskrit for "Guard" or "Sentinel") is an advanced cloud-native security platform. It abandons traditional perimeter-based security in favor of a dynamic, continuous trust model. 

Prahari continuously monitors telemetry from **GuardDuty**, **Security Hub**, and **CloudTrail**. By applying a deterministic risk engine, it calculates dynamic **Trust Scores** for AWS principals (IAM users and roles). If a principal acts suspiciously, Prahari autonomously revokes their active sessions, drops their trust score, and cuts off their application access via AWS Verified Access.

---

## ✨ Key Features (v0.2.0)

*   **⚡ Continuous Trust Model**: Replaces binary authentication with a dynamic 0-100 risk score that continuously adjusts based on user telemetry.
*   **📉 Automated Score Decay**: Trust scores autonomously decay (-5 pts/hour) during periods of no suspicious activity, allowing users to safely recover access without IT intervention.
*   **🛡️ Automated Quarantine**: Instantly cuts access and executes a Step Functions workflow (Global SignOut + DenyAll policy attachment) when scores exceed the critical threshold.
*   **📊 Premium Dual-Role Dashboard**: 
    *   **Admin View**: Global telemetry feed, session control, and supply chain tracking.
    *   **User View**: Personalized security portal explaining the user's current trust score, active signals, and application access blocks.
*   **🔒 Hardened Backend Infrastructure**:
    *   **Cognito ASF Enforced**: Built-in adaptive authentication blocking Tor exit nodes and credential stuffing.
    *   **S3 Object Lock (WORM)**: CloudTrail audit logs are completely immutable and cannot be tampered with.
    *   **AWS X-Ray Distributed Tracing**: Full observability across all microservices.
    *   **SQS Dead-Letter Queues (DLQs)**: Zero event loss guarantee for the processing pipeline.

---

## 🏗️ Architecture

The platform is completely serverless and modularized into 7 core Terraform components:

1.  **Signal Bus**: Ingests security telemetry via EventBridge and an ARM64 Normalizer Lambda.
2.  **ZTNA Broker**: The policy engine (Risk Engine Lambda) that evaluates rules and stores trust profiles in DynamoDB.
3.  **Automated Response**: AWS Step Functions that execute parallel quarantine sequences.
4.  **Dashboard Hosting**: S3 + CloudFront CDN hosting the React frontend, backed by an API Gateway + WAFv2.
5.  **Least Privilege Autopilot**: Analyzes CloudTrail logs to automatically suggest IAM policy down-scoping via GitHub PRs.
6.  **Supply Chain**: Sigstore integration for container signing and provenance.
7.  **EKS Zero Trust** (Optional): Mutual TLS and strict pod policies for Kubernetes.

> 📚 **See the [Architecture Diagrams (docs/diagrams.md)](docs/diagrams.md)** for a complete visual mapping of the telemetry pipeline, user journeys, and state machines.

---

## 🚀 Quick Start & Local Development

### 1. Mock Mode (Frontend Only)
You can run the Premium Dashboard locally without deploying any AWS infrastructure using the built-in Developer Mode.

```bash
cd dashboard
npm install
npm run dev
```
Navigate to `http://localhost:5173`. Click the **Developer Mode** mock login buttons at the bottom of the screen to simulate either an Admin or User experience.

### 2. Full AWS Deployment

**Prerequisites:** AWS CLI, Terraform (v1.5+), Node.js, and an IAM User with `AdministratorAccess` (Do not use Root).

```bash
# 1. Configure variables
cd infra/envs/dev
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your Account ID, Region, and Domain

# 2. Deploy Backend
terraform init
terraform apply

# 3. Configure Frontend
cd ../../../dashboard
cp .env.example .env.local
# Inject the Terraform outputs (API URL, Cognito IDs) into .env.local
npm run build
```

---

## 🧪 Testing & Validation

The core Risk Engine and Signal Normalizers are heavily tested to ensure mathematical correctness of the trust model.
To run the test suite:

```bash
pip install pytest boto3
python -m pytest tests/services/ -v
```

---

## 🤖 CI/CD & Security Scans

Prahari includes automated GitHub Actions pipelines (`.github/workflows/`). 
*   **Terraform Plan**: Automatically runs on every Pull Request.
*   **Trivy**: Scans infrastructure code and containers for known CVEs.
*   **OIDC Federation**: Prahari does *not* use static long-lived IAM keys in CI/CD. It uses GitHub Actions OIDC federation for secure deployment.

---

## 📜 Documentation

For deeper dives into the system architecture and security model, please refer to the `docs/` folder:
- [Architecture & Diagrams](docs/diagrams.md)
- [Threat Model & STRIDE Analysis](docs/threat-model.md)
- [Security & Vulnerability Reporting](SECURITY.md)
- [Contributing Guidelines](CONTRIBUTING.md)
