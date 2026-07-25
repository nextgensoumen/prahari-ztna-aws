# Prahari Architecture: Alternative & Styled Diagrams

This document explores the Prahari ZTNA platform using completely different diagram styles, utilizing advanced Mermaid features (like Block architecture, Timelines, Quadrant Charts, XY Charts, and GitGraphs) along with custom CSS themes to provide a highly distinct visual experience.

---

## 1. System Block Architecture (Block-Beta)
A modern, structural block diagram showing the spatial relationship of the core components.

```mermaid
block-beta
  columns 4
  User(("User\nDevice")) space space space
  down<["HTTPS Request"]>(down)
  WAF["AWS WAF"] space space space
  down<["Filtered Traffic"]>(down)
  
  block:ZeroTrustBroker:4
    columns 2
    Cognito["Amazon Cognito\n(Identity & Auth)"]
    VerifiedAccess["AWS Verified Access\n(Network Gateway)"]
    Cedar["Verified Permissions\n(Policy Engine)"]
    RiskEngine["Risk Engine\n(Trust Scorer)"]
  end
  
  down<["Authorized Context"]>(down)
  InternalApp(("Target\nApplication"))
  
  classDef default fill:#0d1117,stroke:#30363d,stroke-width:2px,color:#c9d1d9,rx:8px;
  classDef accent fill:#1f6feb,stroke:#388bfd,stroke-width:2px,color:#ffffff,rx:8px;
  class ZeroTrustBroker accent
```

---

## 2. Zero Trust User Journey
A journey map tracking a user's experience as their trust score fluctuates and they are eventually blocked.

```mermaid
journey
    title The Prahari Adaptive Access Journey
    section Normal Operation
      Log in via Cognito: 5: User
      Access Internal App: 5: User, ZTNA
    section Suspicious Activity
      Log in from Tor Node: 2: User, GuardDuty
      Trust Score Plummets: 1: Risk Engine, DynamoDB
    section Automated Response
      Access Revoked instantly: 4: Verified Access, Cedar
      Sessions Terminated: 5: Step Functions, Cognito
```

---

## 3. Styled Data Pipeline (Themed Flowchart)
A standard flowchart entirely restyled with custom colors, dashed lines, and varied node shapes.

```mermaid
flowchart LR
    %% Custom Styling
    classDef source fill:#f6ad55,stroke:#dd6b20,stroke-width:2px,color:#1a202c,rx:10px
    classDef router fill:#63b3ed,stroke:#3182ce,stroke-width:3px,color:#1a202c,rx:20px
    classDef compute fill:#68d391,stroke:#38a169,stroke-width:2px,color:#1a202c
    classDef storage fill:#b794f4,stroke:#805ad5,stroke-width:2px,color:#ffffff
    
    A([GuardDuty]):::source -.->|JSON| B{EventBridge}:::router
    C([CloudTrail]):::source -.->|JSON| B
    
    B ==>|Routes Event| D[Normalizer Lambda]:::compute
    D ==>|Transforms| E[(DynamoDB)]:::storage
    D -->|Emits| F{Signal Bus}:::router
```

---

## 4. Threat Prioritization Matrix (Quadrant Chart)
A strategic view of how Prahari prioritizes different security events.

```mermaid
quadrantChart
    title Threat Scenario Prioritization Matrix
    x-axis Low Likelihood --> High Likelihood
    y-axis Low Impact --> High Impact
    quadrant-1 Immediate Quarantine
    quadrant-2 Monitor & Degrade Trust
    quadrant-3 Ignore / Log
    quadrant-4 Audit Trail Review
    "Compromised IAM Credentials": [0.8, 0.9]
    "Tor Exit Node Login": [0.7, 0.8]
    "S3 Bucket Made Public": [0.65, 0.85]
    "Failed Login Attempt": [0.9, 0.3]
    "Routine API Call": [0.95, 0.1]
    "Root Account Login": [0.2, 0.95]
```

---

## 5. Threat Response Timeline
A chronological view of an automated response happening in milliseconds.

```mermaid
timeline
    title Incident Response Timeline (Sub-second execution)
    T+0ms : GuardDuty
          : Detects IAM credential exfiltration
    T+100ms : EventBridge
            : Routes event to Normalizer
    T+400ms : Risk Engine
            : Applies +50 penalty
            : Score hits 95 (Critical)
    T+600ms : Verified Access
            : Cedar Policy evaluates new score
            : Instantly blocks network traffic
    T+1500ms : Step Functions
             : Triggers Global SignOut in Cognito
             : Attaches AWSDenyAll SCP to Role
```

---

## 6. Project Complexity Distribution (Pie Chart)
A breakdown of the relative code and configuration footprint of the platform.

```mermaid
pie title Infrastructure Complexity Breakdown (Terraform)
    "ZTNA Broker & Risk Engine" : 35
    "Signal Bus & Normalizer" : 20
    "Automated Response" : 15
    "Least-Privilege Autopilot" : 15
    "Dashboard Hosting" : 10
    "Supply Chain Gate" : 5
```

---

## 7. Dynamic Trust Score Simulation (XY Chart)
A visual chart tracking a hypothetical user's risk score over a 5-hour period.

```mermaid
xychart-beta
    title "User Risk Score Volatility (Threshold = 50)"
    x-axis "Time" ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"]
    y-axis "Risk Score" 0 --> 100
    line [0, 0, 20, 85, 80, 0]
    bar  [0, 0, 20, 85, 80, 0]
```
*(Explanation: Normal activity at 8-9am. Unusual login at 10am bumps score to 20. Critical GuardDuty alert at 11am spikes score to 85, triggering immediate blockade. Admin resets score at 1pm).*

---

## 8. Least-Privilege GitOps Loop (GitGraph)
Visualizing how the Autopilot bot proposes IAM changes via Git branches instead of applying them directly.

```mermaid
gitGraph
    commit id: "Initial IAM Policy"
    branch autopilot/tighten-role-dev
    checkout autopilot/tighten-role-dev
    commit id: "Access Analyzer: Remove S3:* action"
    commit id: "Access Analyzer: Add specific S3 bucket ARN"
    checkout main
    merge autopilot/tighten-role-dev tag: "Security Approved"
    commit id: "Terraform Apply triggered"
```

---

## 9. State Machine Process Map (Themed StateDiagram)
A distinct visual mapping of the Step Functions quarantine logic using concurrent blocks.

```mermaid
stateDiagram-v2
    classDef critical fill:#ef4444,color:white,font-weight:bold,stroke-width:2px,stroke:#7f1d1d
    classDef pass fill:#22c55e,color:white,stroke:#14532d
    
    state "Evaluate Signal" as Eval
    state "Score > 80?" as Check
    
    [*] --> Eval
    Eval --> Check
    Check --> Safe:::pass : NO
    Check --> Quarantine_Sequence:::critical : YES
    
    state Quarantine_Sequence {
        state "Identity Lockdown" as Id
        state "AWS API Lockdown" as API
        --
        [*] --> Id
        Id --> RevokeCognitoTokens
        --
        [*] --> API
        API --> AttachDenyAllPolicy
    }
    
    Safe --> [*]
    Quarantine_Sequence --> [*]
```

---

## 10. Architectural Layering (Requirement Map)
Mapping out how requirements are satisfied by specific testable elements.

```mermaid
requirementDiagram
    requirement test_req {
    id: 1
    text: Platform must have zero static AWS keys
    risk: high
    verifymethod: analysis
    }

    element test_entity {
    type: OIDC Federation
    }

    test_entity - satisfies -> test_req
    
    requirement deny_req {
    id: 2
    text: Must block access instantly on high risk
    risk: high
    verifymethod: test
    }
    
    element cedar_policy {
    type: Cedar Forbid Rule
    }
    
    cedar_policy - satisfies -> deny_req
```
