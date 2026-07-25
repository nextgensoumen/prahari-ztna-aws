# Session 08 — Admin Dashboard SOC Features
Date: 2026-07-25
Module/phase touched: dashboard/src (Frontend)
What changed:
- **SOC Quick Action Bar**: Added an emergency response panel to the top of the Admin Dashboard. Includes a "Quarantine All High-Risk" button, "Force Policy Sync", and "Export Audit Logs".
- **System Health Grid**: Added a 4-metric grid to track ZTNA backend operational health (Event Latency, DLQ Depth, Active Cedar Policies, Events Processed).
- **MITRE ATT&CK Landscape**: Added a visualization widget that categorizes raw findings into MITRE tactics (Initial Access, Privilege Escalation, Defense Evasion).
- **Layout Refactoring**: Converted the `AdminDashboard` component to use a `gridTemplateColumns: 1fr 340px` split layout to better organize the massive amount of telemetry data.
Why (the reasoning, not just the diff):
- The original Admin Dashboard was essentially just a feed of findings. A true Security Operations Center (SOC) requires operational awareness (are the pipelines healthy?) and immediate incident response capabilities (emergency quarantine).
- Categorizing raw CloudTrail/GuardDuty findings into MITRE tactics helps analysts instantly understand the *intent* of an anomaly, rather than just its severity.
Files touched:
- `dashboard/src/index.css`
- `dashboard/src/components/Widgets.jsx`
- `dashboard/src/pages/Pages.jsx`
Open questions / next step:
- The SOC Action buttons currently trigger JS `alert()` mocks. In Phase 3, these need to be wired up to actual API Gateway endpoints (e.g., an endpoint to trigger a Step Function execution across all high-risk users).
- MITRE categorization currently uses mocked substring logic in the frontend. This should be moved to the backend Normalizer lambdas so the `findings` API returns an explicit `mitre_tactic` field.
