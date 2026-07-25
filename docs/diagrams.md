# Prahari Architecture Diagrams

This document contains 10 comprehensive diagrams detailing the architecture, data flows, lifecycles, and security posture of the Prahari ZTNA platform.

---

## 1. System Overview Flow
This diagram illustrates the high-level flow of a user accessing the environment through the Zero Trust components.

```mermaid
graph TD
    User([End User / Developer]) --> WAF[AWS WAF]
    WAF --> Auth{Amazon Cognito}
    Auth -- Issues Token --> VA[AWS Verified Access]
    Auth -- Authenticates --> Dash[Prahari Dashboard API]
    VA --> Cedar{Verified Permissions}
    Cedar -- Evaluates Trust Score --> Allow[Allowed Internal App]
    Cedar -- Score > Threshold --> Deny[Access Denied]
```

---

## 2. Module Execution Lifecycle (Telemetry to Response)
The end-to-end lifecycle of a security event, from detection to automated quarantine.

```mermaid
sequenceDiagram
    participant Source as AWS Sources (GuardDuty, Security Hub)
    participant Bus as Signal Bus
    participant RE as Risk Engine
    participant DB as DynamoDB (Scores)
    participant AS as Automated Response
    
    Source->>Bus: Raw Telemetry Event
    Bus->>Bus: Normalizer Lambda format to internal schema
    Bus->>RE: Emit Normalized Event
    RE->>DB: Fetch Current Trust Score
    RE->>RE: Apply Rules & Add Penalty
    RE->>DB: Write New Trust Score
    RE-->>Bus: Emit RiskScoreUpdated Event
    Bus->>AS: If Score > 80 (Critical)
    AS->>AS: Trigger Step Functions Playbook
    AS->>Auth: Revoke Active Cognito Sessions
    AS->>IAM: Attach AWSDenyAll Policy to Role
```

---

## 3. Internal Module Architecture: Signal Bus
How the central telemetry router handles noisy AWS logs.

```mermaid
graph LR
    subgraph Sources
    GD[GuardDuty]
    SH[Security Hub]
    CT[CloudTrail]
    end

    subgraph Signal Bus Module
    EB[EventBridge Default Bus]
    NL[Normalizer Lambda]
    PB[Prahari EventBridge Bus]
    end

    subgraph Storage
    DDB[(DynamoDB Events)]
    end

    GD --> EB
    SH --> EB
    CT --> EB
    EB -- Triggers --> NL
    NL -- Normalizes & Writes --> DDB
    NL -- Emits Internal Event --> PB
```

---

## 4. Internal Module Architecture: ZTNA Broker
The Zero Trust Network Access evaluation engine.

```mermaid
graph TD
    subgraph Identity
    Cog[Cognito User Pool]
    end

    subgraph ZTNA Broker
    VA[Verified Access Endpoint]
    VP[Verified Permissions Policy Store]
    end

    subgraph Risk
    RE[Risk Engine Lambda]
    Scores[(Trust Scores)]
    end

    User -->|OAuth / OIDC| Cog
    User -->|HTTPS Request| VA
    VA -->|Evaluate Token| VP
    RE -.->|Updates Risk Context| Scores
    VP -.->|Reads Entity Data| Scores
    VP -- Allow/Deny --> App[Target Application]
```

---

## 5. Project Directory Map
A logical mapping of the Terraform repository structure.

```mermaid
mindmap
  root((Prahari ZTNA))
    infra
      global
        state-backend
      envs
        dev
        prod
      modules
        signal-bus
        ztna-broker
        automated-response
        dashboard-hosting
        least-priv-autopilot
        supply-chain
    services
      signal-normalizer
      risk-engine
      policy-diff-bot
    dashboard
      src
      public
    docs
```

---

## 6. Security Threat Coverage Map
Mapping STRIDE threats to Prahari's mitigation components.

```mermaid
graph TD
    subgraph Threats (STRIDE)
    S[Spoofing]
    T[Tampering]
    R[Repudiation]
    I[Information Disclosure]
    D[Denial of Service]
    E[Elevation of Privilege]
    end

    subgraph Mitigations
    MFA[Cognito MFA & Identity]
    SIG[Sigstore Keyless Signing]
    CT[CloudTrail Logs & S3 Locks]
    TLS[Verified Access HTTPS/TLS]
    WAF[WAF Rate Limiting]
    LPA[Least-Privilege Autopilot]
    end

    S --> MFA
    T --> SIG
    R --> CT
    I --> TLS
    D --> WAF
    E --> LPA
```

---

## 7. Supply Chain Gate Lifecycle
How code transitions from a commit to a verified deployment.

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub Actions
    participant CB as AWS CodeBuild
    participant Sig as Sigstore / Cosign
    participant ECR as Amazon ECR
    
    Dev->>GH: Push Code
    GH->>CB: AssumeRoleWithWebIdentity (OIDC)
    CB->>CB: Build Docker Image
    CB->>Sig: Sign Image (Keyless)
    Sig-->>CB: Signature & Attestation
    CB->>ECR: Push Signed Image
    GH->>GH: Validate Signature before Apply
```

---

## 8. Least-Privilege Autopilot Flow
The continuous GitOps loop for tightening IAM permissions.

```mermaid
graph TD
    CT[CloudTrail IAM Activity] --> EB[EventBridge]
    EB --> SF[Step Functions Scheduled Trigger]
    SF --> AA[IAM Access Analyzer]
    AA -- Generates --> Policy[Optimized JSON Policy]
    SF --> Bot[Policy Diff Bot Lambda]
    Bot --> PR[GitHub Pull Request]
    PR -- Review & Merge --> TF[Terraform Apply]
```

---

## 9. Automated Response Playbook
The internal logic of the Step Functions quarantine state machine.

```mermaid
stateDiagram-v2
    [*] --> CheckThreshold
    CheckThreshold --> IsCritical : Score > 80
    CheckThreshold --> End : Score < 80
    
    IsCritical --> ParallelBranch
    
    state ParallelBranch {
        [*] --> RevokeSessions
        [*] --> QuarantineIAM
        
        RevokeSessions --> GlobalSignOut
        GlobalSignOut --> DisableUser
        
        QuarantineIAM --> AttachAWSDenyAll
        AttachAWSDenyAll --> NotifyAdmin
    }
    
    ParallelBranch --> LogResponse
    LogResponse --> End
    End --> [*]
```

---

## 10. Data & Persistence Layer
How state, logs, and telemetry are persisted and protected.

```mermaid
graph TD
    subgraph S3 Buckets
    TF[Terraform State Bucket]
    CTB[CloudTrail Logs Bucket]
    Dash[Dashboard Static Assets]
    end

    subgraph DynamoDB
    TFL[Terraform Locks]
    PPE[Platform Events - PITR]
    PTS[Trust Scores - PITR]
    end

    TF -.->|Locked by| TFL
    CTB -.->|90-day Expiration| Delete
    PPE -.->|35-day Recovery| Backups
    PTS -.->|24h TTL| Expire
```
