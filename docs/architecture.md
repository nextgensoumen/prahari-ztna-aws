# Prahari Platform Architecture

Prahari is a Zero Trust Access & Governance platform for AWS. It is composed of 7 distinct modules.

## Architecture Diagram

```mermaid
graph TD
    subgraph Supply Chain
        GH[GitHub Actions] -->|OIDC| CB[CodeBuild]
        CB --> ECR[ECR + Scanning]
        CB -->|Sigstore| S3Ev[S3 Evidence]
    end

    subgraph Telemetry Bus
        CT[CloudTrail] --> EB[EventBridge Bus]
        GD[GuardDuty] --> EB
        SH[Security Hub] --> EB
        EB --> Nrm[Normalizer Lambda]
        Nrm --> DDB_E[DDB: Platform Events]
    end

    subgraph Zero Trust Identity & Access
        Cog[Cognito IDP] --> VAP[Verified Access]
        Cog --> Dbd[Dashboard SPA]
        VAP --> App[Protected App]
        Cedar{Cedar Policy} --> VAP
    end

    subgraph Risk Engine
        EB --> RE[Risk Engine Lambda]
        RE --> DDB_T[DDB: Trust Scores]
    end

    subgraph Automated Response
        RE -->|High Risk| SFN[Step Functions]
        GD -->|Severity > 7| SFN
        SFN -->|Quarantine| IAM[IAM Role DenyAll]
        SFN -->|Revoke| Cog
    end

    subgraph Autopilot
        IAMAA[Access Analyzer] --> Dbot[Policy Diff Bot]
        Dbot -->|PR| GH
    end

    Dbd -->|API Gateway| Api[Dashboard API]
    Api --> DDB_E
    Api --> DDB_T
    Api --> SFN
```

## Module Overview

1. **Supply Chain**: Prevents untrusted code from running. Validates SBOMs and enforces artifact signing via Sigstore.
2. **Least-Privilege Autopilot**: Uses IAM Access Analyzer to generate right-sized policies based on CloudTrail usage, opening a GitHub PR instead of auto-applying.
3. **Signal Bus**: A central EventBridge bus that normalizes GuardDuty, Security Hub, and CloudTrail events into a single schema.
4. **ZTNA Broker**: Replaces VPNs with AWS Verified Access, gated by Cedar policies and Cognito identity.
5. **Risk Engine**: Continuously evaluates user trust scores based on telemetry.
6. **Automated Response**: A Step Functions playbook that quarantines IAM roles and revokes Cognito sessions on high-risk events.
7. **Dashboard**: A React SPA hosted on CloudFront providing a single pane of glass for security analysts.
