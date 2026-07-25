# प Prahari — Zero Trust Access & Governance

Prahari (Sanskrit for "Guard" or "Sentinel") is a production-grade, event-driven Zero Trust Network Access (ZTNA) and governance platform built entirely on AWS using Terraform. 

It continuously monitors telemetry from GuardDuty, Security Hub, and CloudTrail, calculating dynamic trust scores for AWS principals (IAM users and roles). If a principal acts suspiciously, Prahari automatically revokes their active sessions and adjusts their access via AWS Verified Access.

---

## 🏗️ Architecture Overview

The platform is modularized into 7 core Terraform components:
1. **Signal Bus**: Ingests security telemetry via EventBridge and Normalizer Lambdas.
2. **ZTNA Broker**: The policy engine that calculates Trust Scores and stores them in DynamoDB (with PITR enabled).
3. **Automated Response**: AWS Step Functions that automatically revoke active sessions for high-risk principals.
4. **Dashboard Hosting**: S3 + CloudFront with strict Security Headers (HSTS, CSP).
5. **Least Privilege Autopilot**: Analyzes CloudTrail logs to automatically suggest IAM policy down-scoping via GitHub PRs.
6. **Supply Chain**: Sigstore integration for container signing and provenance.
7. **EKS Zero Trust** (Optional): Mutual TLS and strict pod policies for Kubernetes.

---

## 🚀 Deployment Guide

### Prerequisites
- **AWS CLI** installed and configured.
- **Terraform** (v1.5+) installed.
- **Node.js & npm** installed (for local dashboard development).
- A registered **Domain Name** (for AWS Verified Access and Cognito).

### Step 1: AWS Credentials
You must use an **IAM User** with `AdministratorAccess` to deploy this stack. **Never use your AWS Root Account.**

Configure your AWS CLI with your IAM credentials:
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
```

### Step 2: Configure Terraform Environment
Navigate to the development environment folder and configure your variables.

```bash
cd infra/envs/dev
cp terraform.tfvars.example terraform.tfvars
```

Open `terraform.tfvars` and fill in your specific details:
```hcl
aws_region       = "us-east-1"
aws_account_id   = "123456789012"          # Replace with your 12-digit AWS Account ID
environment      = "dev"
root_domain      = "prahari.yourdomain.com"
admin_email      = "security@yourdomain.com"
```

### Step 3: Deploy Infrastructure
Initialize Terraform and deploy the stack. This will create the Cognito User Pools, API Gateways, DynamoDB tables, Lambdas, and EventBridge rules.

```bash
terraform init
terraform plan
terraform apply
```
*(Type `yes` when prompted to approve the deployment)*.

**Note down the Terraform Outputs:** Once the deployment finishes, Terraform will output your `API Gateway URL`, `Cognito User Pool ID`, and `Cognito Client ID`. You will need these for the frontend.

### Step 4: Configure the Dashboard
The React dashboard needs to know how to talk to your newly deployed backend.

```bash
cd ../../../dashboard
cp .env.example .env.local
```

Edit `.env.local` with the values from your Terraform output:
```env
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_abcdefghi
VITE_COGNITO_CLIENT_ID=1234567890abcdef
VITE_API_URL=https://xyz.execute-api.us-east-1.amazonaws.com/v1
```

### Step 5: Run the Dashboard Locally
Install the dependencies and start the Vite development server.

```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. You will be greeted by the Prahari ZTNA login screen.

---

## 🤖 GitHub Actions CI/CD Setup

Prahari comes with automated CI/CD pipelines in `.github/workflows/`. To enable these, you must provide GitHub with AWS access.

Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
Add the following secrets:
1. `AWS_ACCESS_KEY_ID`: Your IAM user access key.
2. `AWS_SECRET_ACCESS_KEY`: Your IAM user secret key.

Once added, every Pull Request will be scanned by Trivy for security vulnerabilities, and Terraform will automatically run a `plan` against your AWS environment.

---

## 📜 Documentation

For deeper dives into the system architecture and security model, please refer to the `docs/` folder:
- [Architecture & Design](docs/architecture.md)
- [Threat Model & STRIDE Analysis](docs/threat-model.md)
- [Security & Vulnerability Reporting](SECURITY.md)
- [Contributing Guidelines](CONTRIBUTING.md)
