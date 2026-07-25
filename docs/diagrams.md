# Prahari Architecture: Alternative & Styled Diagrams (v2)

This document reflects the **fully hardened, production-grade** state of the Prahari ZTNA platform after Phase 2 backend strengthening. All diagrams have been updated to show new components: X-Ray tracing, score decay, ARM64 Lambdas, Cognito ASF, Object Lock, unit tests, and the fixed EventBridge routing.

---

## 1. System Architecture Overview (Block-Beta)
Spatial layout of all platform components after full hardening.

```mermaid
block-beta
  columns 4

  User(("👤 User\nDevice")) space WAF["AWS WAF\n(Rate Limit + Rules)"] space

  block:Identity:2
    Cognito["Amazon Cognito\n(MFA ON · ASF ENFORCED)"]
    Cedar["Verified Permissions\n(Cedar Forbid Rules)"]
  end

  block:ZeroTrust:2
    VA["AWS Verified Access\n(ZTNA Endpoint)"]
    RE["Risk Engine λ\n(ARM64 · X-Ray · Decay)"]
  end

  block:Observability:2
    XRay["AWS X-Ray\n(Distributed Traces)"]
    CWAlarms["CloudWatch Alarms\n(DLQ Depth · Errors)"]
  end

  block:DataLayer:2
    Events[("DynamoDB\nPlatform Events\n(PITR ON)")]
    Scores[("DynamoDB\nTrust Scores\n(TTL 24h)")]
  end
```

---

## 2. Zero Trust User Journey (with Adaptive Auth)
The end-to-end adaptive experience — now including Cognito ASF blocking Tor nodes.

```mermaid
journey
    title Prahari Adaptive Access Journey (v2 — with ASF & Decay)
    section Normal Operation
      Log in via Cognito + MFA: 5: User
      Cognito ASF: risk score = LOW: 5: ASF
      Access Internal App via Verified Access: 5: User, ZTNA
    section Suspicious Activity
      Log in from Tor Exit Node: 1: User
      Cognito ASF blocks login immediately: 5: ASF, Cognito
      GuardDuty fires critical finding: 2: GuardDuty
      Trust Score spikes to 95: 1: Risk Engine
    section Recovery (NEW — Score Decay)
      No new events for 10 hours: 4: System
      Score decays -5/hr → drops to 45: 4: Risk Engine
      Access automatically restored: 5: Verified Access
```

---

## 3. Telemetry Pipeline with X-Ray Tracing
The full event flow with the feedback-loop fix and distributed tracing.

```mermaid
flowchart LR
    classDef source   fill:#f6ad55,stroke:#dd6b20,color:#1a202c,rx:10px
    classDef compute  fill:#68d391,stroke:#38a169,color:#1a202c
    classDef storage  fill:#b794f4,stroke:#805ad5,color:#ffffff
    classDef trace    fill:#63b3ed,stroke:#3182ce,color:#1a202c,stroke-dasharray:4 2
    classDef block    fill:#fc8181,stroke:#c53030,color:#ffffff

    GD([GuardDuty]):::source -.->|Raw Event| EB{EventBridge}
    SH([Security Hub]):::source -.->|Raw Event| EB
    CT([CloudTrail]):::source -.->|Raw Event| EB

    EB ==>|Route by source| NL["Normalizer λ\n(ARM64 · X-Ray)"]:::compute
    NL ==>|Normalized Schema| DB[(Platform Events\nDynamoDB)]:::storage
    NL -->|Emit to Signal Bus| SB{Signal Bus}

    SB ==>|aws.guardduty ONLY\n aws.securityhub ONLY\n aws.cloudtrail ONLY| RE["Risk Engine λ\n(ARM64 · X-Ray · Decay)"]:::compute
    RE ==>|Update Score| SC[(Trust Scores\nDynamoDB)]:::storage
    RE -->|Emit RiskScoreUpdated\nprahari.risk-engine| SB

    BLOCK:::block -.->|BLOCKED — prahari.*\nsource filtered out| SB
    BLOCK["⛔ Self-loop\nPrevented"]

    XR["AWS X-Ray\nService Map"]:::trace -. traces .-> NL
    XR -. traces .-> RE
```

---

## 4. Trust Score Model (Quadrant Risk Matrix)
Updated to include 2 new scoring rules added in Phase 2.

```mermaid
quadrantChart
    title Trust Score Rule Weight Matrix
    x-axis Low Likelihood --> High Likelihood
    y-axis Low Severity --> High Severity
    quadrant-1 Quarantine Immediately
    quadrant-2 High Alert — Monitor Closely
    quadrant-3 Informational — Log Only
    quadrant-4 Investigate — Check Context
    "Root Account Login (+60)": [0.15, 0.98]
    "GuardDuty Critical (+50)": [0.4, 0.95]
    "Audit Trail Tamper (+40)": [0.2, 0.9]
    "Shadow Admin Create (+35)": [0.3, 0.85]
    "Privilege Escalation (+25)": [0.65, 0.8]
    "GuardDuty High (+30)": [0.55, 0.75]
    "ConsoleLogin (+20)": [0.9, 0.3]
    "SecHub High (+20)": [0.6, 0.65]
    "MFA Login (-20)": [0.85, 0.1]
```

---

## 5. Incident Response Timeline (Full Platform)
End-to-end sub-second response with score decay showing user recovery.

```mermaid
timeline
    title Incident Lifecycle (Attack → Quarantine → Recovery)
    T+0ms : GuardDuty detects Tor node credential use
    T+100ms : EventBridge routes to Normalizer Lambda
    T+400ms : Risk Engine applies +50 penalty. Score → 95 (CRITICAL)
    T+600ms : Cedar Policy denies all new access attempts
    T+1500ms : Step Functions triggers parallel quarantine
    T+2000ms : Cognito Global SignOut + AWSDenyAll attached to role
    T+5hrs : Score decays → -25 pts (5pts/hr × 5hrs) = 70
    T+19hrs : Score fully decays to 0. Principal trusted again.
```

---

## 6. Backend Resilience Architecture (Pie Chart)
Breakdown of resilience mechanisms added across all phases.

```mermaid
pie title Backend Resilience Coverage by Feature
    "Unit Tests (48 tests)" : 20
    "Lambda DLQs (zero message loss)" : 15
    "CloudWatch DLQ Alarms" : 10
    "ARM64 Cost Optimization" : 10
    "X-Ray Distributed Tracing" : 15
    "WAFv2 Perimeter Defense" : 15
    "S3 Object Lock (Audit WORM)" : 15
```

---

## 7. Dynamic Trust Score Simulation (Before vs After Decay)
Comparing the old binary TTL model vs the new continuous decay model.

```mermaid
xychart-beta
    title "Trust Score: Old Binary Model vs New Decay Model"
    x-axis "Time (hours)" [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
    y-axis "Risk Score" 0 --> 100
    line [0, 0, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 0]
    bar  [0, 0, 95, 70, 45, 20, 0, 0, 0, 0, 0, 0, 0]
```
*(Line = old 24h TTL model. Bar = new -5pts/hour decay model. User recovers in ~19h instead of 24h.)*

---

## 8. Test Coverage GitGraph
How unit tests were introduced via a clean branch and merged.

```mermaid
gitGraph
    commit id: "Initial Scaffolding"
    commit id: "Signal Bus + Normalizer"
    commit id: "ZTNA Broker + Risk Engine"
    commit id: "Dashboard + Automated Response"
    branch phase2/backend-hardening
    checkout phase2/backend-hardening
    commit id: "Fix EventBridge feedback loop"
    commit id: "ARM64 + X-Ray on all Lambdas"
    commit id: "Cognito ASF ENFORCED"
    commit id: "S3 Object Lock CloudTrail"
    commit id: "Risk Engine: score decay + 2 new rules"
    commit id: "48 unit tests: risk_engine + normalizer"
    checkout main
    merge phase2/backend-hardening tag: "v0.2.0"
    commit id: "Memory log 05 updated"
```

---

## 9. Automated Response State Machine (With Recovery Path)
Updated state diagram showing the quarantine + recovery lifecycle.

```mermaid
stateDiagram-v2
    classDef critical fill:#ef4444,color:white,font-weight:bold,stroke:#7f1d1d
    classDef pass    fill:#22c55e,color:white,stroke:#14532d
    classDef decay   fill:#3b82f6,color:white,stroke:#1e3a8a

    [*] --> EvaluateScore
    EvaluateScore --> BelowThreshold:::pass  : Score < 50
    EvaluateScore --> Quarantine:::critical  : Score ≥ 80

    state Quarantine {
        --
        RevokeSession : Cognito GlobalSignOut
        AttachDenyPolicy : IAM AWSDenyAll
    }

    BelowThreshold --> Monitor:::decay
    Monitor:::decay --> Decay : -5pts/hour applied
    Decay --> BelowThreshold : Score hits 0
    Quarantine --> Decay:::decay : Admin manually clears flag
    Decay --> [*]
```

---

## 10. Security Control Coverage Map
Full mapping of STRIDE threats → mitigations deployed across all phases.

```mermaid
requirementDiagram
    requirement no_static_keys {
        id: 1
        text: No static AWS keys anywhere in pipeline
        risk: high
        verifymethod: analysis
    }
    element oidc_federation {
        type: OIDC GitHub Actions
    }
    oidc_federation - satisfies -> no_static_keys

    requirement mfa_required {
        id: 2
        text: All users must use MFA + adaptive auth
        risk: high
        verifymethod: test
    }
    element cognito_asf {
        type: Cognito MFA=ON + ASF=ENFORCED
    }
    cognito_asf - satisfies -> mfa_required

    requirement tamper_proof_logs {
        id: 3
        text: Audit logs cannot be deleted by any principal
        risk: high
        verifymethod: inspection
    }
    element s3_object_lock {
        type: S3 Object Lock WORM
    }
    s3_object_lock - satisfies -> tamper_proof_logs

    requirement no_event_loss {
        id: 4
        text: No security events silently dropped
        risk: medium
        verifymethod: test
    }
    element sqs_dlq {
        type: SQS DLQ + CW Alarms
    }
    sqs_dlq - satisfies -> no_event_loss
```
