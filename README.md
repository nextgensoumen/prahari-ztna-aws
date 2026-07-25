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

## 🚀 Comprehensive Deployment Guide

Prahari is designed to be deployed into a dedicated AWS Security/Audit account. It requires no manual console clicks—everything is codified in Terraform.

### Prerequisites
1. **AWS CLI** (v2) configured with an IAM User or Role that has `AdministratorAccess`. *(Do not deploy as the Root User)*.
2. **Terraform** (v1.5.0 or higher).
3. **Node.js** (v18+) for building the React frontend.
4. A registered **Domain Name** (hosted in Route53 or elsewhere) for CloudFront and AWS Verified Access.

### Phase 1: Infrastructure Deployment
The backend infrastructure is completely serverless. Terraform will deploy EventBridge, Step Functions, DynamoDB, API Gateway, WAFv2, and Cognito.

```bash
# 1. Navigate to the development environment
cd infra/envs/dev

# 2. Configure your environment variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your specific details:
# aws_region       = "us-east-1"
# aws_account_id   = "123456789012"
# root_domain      = "security.yourcompany.com"
# admin_email      = "secops@yourcompany.com"

# 3. Initialize and Apply
terraform init
terraform plan
terraform apply
```
*Note: Terraform will output three critical values at the end: `api_url`, `cognito_user_pool_id`, and `cognito_client_id`. Save these for Phase 2.*

### Phase 2: Frontend Deployment
The React dashboard is hosted as a static site on Amazon S3 and distributed globally via CloudFront.

```bash
# 1. Navigate to the dashboard directory
cd ../../../dashboard

# 2. Configure environment variables
cp .env.example .env.local

# Edit .env.local using the Terraform outputs from Phase 1:
# VITE_AWS_REGION=us-east-1
# VITE_COGNITO_USER_POOL_ID=<from_terraform>
# VITE_COGNITO_CLIENT_ID=<from_terraform>
# VITE_API_URL=<from_terraform>

# 3. Build for Production
npm install
npm run build

# 4. Deploy to S3 (replace with your actual bucket name)
aws s3 sync dist/ s3://prahari-dashboard-dev-hosting --delete

# 5. Invalidate CloudFront Cache
aws cloudfront create-invalidation --distribution-id <YOUR_DIST_ID> --paths "/*"
```

---

## 📖 User Manual & Operations

Prahari operates autonomously, but Security Operations (SecOps) teams interact with the platform through the dashboard and AWS console.

### 1. Navigating the Dashboard
The platform uses **Amazon Cognito Groups** to determine what users can see:
* **SecOps Admins (Group: `prahari-admins`)**: Can view the global telemetry feed, see all active sessions across the organization, review the automated supply chain pipeline, and manually trigger session revocations.
* **Standard Users**: Can only view their own personalized "Security Status" page. This page shows their current Trust Score, explains why their score is at that level (e.g., "You logged in without MFA"), and lists which internal tools are currently blocked or allowed by AWS Verified Access based on that score.

### 2. How the Trust Score Works
Every AWS principal (IAM User or Role) starts with a Trust Score of **0** (Fully Trusted).
* **Telemetry Ingestion**: When GuardDuty detects an anomaly (e.g., unusual login region) or Security Hub flags a violation, EventBridge routes that event to Prahari's Risk Engine.
* **Score Increase**: The Risk Engine normalizes the event and adds points to the principal's score. (e.g., GuardDuty High = +40 pts).
* **Score Decay**: To prevent scores from remaining artificially high forever, Prahari implements an autonomous decay algorithm. If a principal generates no new security alerts, their score decays at a rate of **-5 points per hour**.
* **Thresholds**: 
  * `0-30`: Trusted (Green)
  * `31-49`: Moderate Risk (Yellow)
  * `50+`: High Risk (Red) - Automatically quarantined.

### 3. Incident Response (Automated Quarantine)
When a principal's score hits **50**, Prahari's AWS Step Functions immediately execute a quarantine sequence:
1. Revokes all active AWS console/CLI sessions (Global Sign-Out).
2. Attaches an explicit `DenyAll` IAM policy to the user/role.
3. Signals AWS Verified Access to instantly terminate the user's connection to all internal corporate applications.
4. Generates an alert in the SecOps PagerDuty/Slack channel.

### 4. The Least Privilege Autopilot
Prahari doesn't just react to threats; it actively shrinks attack surfaces. 
Every week, an automated workflow analyzes CloudTrail logs using AWS IAM Access Analyzer. It compares what permissions an IAM role *has* versus what it actually *used*. It then automatically generates a GitHub Pull Request proposing a new, tightened Terraform IAM policy, dropping unused permissions.

---

## 🧪 Local Testing (Developer Mode)

You can run the React frontend locally without deploying the AWS backend to preview the UI.

```bash
cd dashboard
npm install
npm run dev
```
Navigate to `http://localhost:5173`. Instead of logging in with real credentials, click the **"Simulate Admin Login"** or **"Simulate User Login"** buttons at the bottom of the screen to preview the respective dashboard experiences using mock data.

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
