# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-25

### Added
- **State Backend**: S3 + DynamoDB Terraform backend.
- **Supply Chain**: CodeBuild integration, ECR scanning, Sigstore signing capability.
- **Autopilot**: IAM Access Analyzer integration and GitHub PR generation via Lambda.
- **Signal Bus**: Central EventBridge bus for GuardDuty, Security Hub, and CloudTrail, with data normalization to DynamoDB.
- **ZTNA Broker**: Amazon Cognito User Pool and AWS Verified Access setup, governed by Cedar policies.
- **Risk Engine**: Lambda function that updates continuous trust scores in DynamoDB based on security telemetry.
- **Automated Response**: Step Functions state machine with parallel branches for Cognito session revocation and IAM quarantine (`AWSDenyAll`).
- **Dashboard**: React SPA (dark glassmorphism) hosted on CloudFront/S3, backed by API Gateway and Lambda.
- **Documentation**: Architecture diagrams, threat model, contributing guidelines, and security policies.
