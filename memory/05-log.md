# Session 05 — Dashboard: CloudFront + API Gateway + React App
Date: 2026-07-25
Module/phase touched: dashboard-hosting, services/dashboard-api, dashboard/ (React)
What changed:
- Created the `dashboard-hosting` Terraform module: S3 static bucket (private, OAC), CloudFront distribution (HTTPS-only, SPA 404→index.html routing, PriceClass_100), API Gateway REST API with Cognito JWT authorizer, and the dashboard API Lambda. A second Cognito User Pool Client (PKCE, no secret) was added for the SPA.
- Built the `dashboard-api` Lambda (Python): handles six routes (`/findings`, `/sessions`, `/sessions/revoke`, `/pipeline`, `/policies`, `/me`) with per-route admin/user RBAC enforced by the Cognito `cognito:groups` JWT claim. Session revoke triggers the automated-response Step Functions state machine.
- Built the complete React + Vite dashboard:
  - Global CSS: dark glassmorphism design system with HSL-tuned palette, Inter font, animated hover states.
  - `Sidebar.jsx`: role-adaptive navigation (admins get 5 pages, users get 2), Cognito sign-out button.
  - `Widgets.jsx`: `TrustScoreGauge` (SVG ring with animated stroke), `FindingCard`, `SessionRow`, `PipelineRow`.
  - `Pages.jsx`: `AdminDashboard`, `UserDashboard`, `FindingsPage`, `SessionsPage`, `PoliciesPage`, `PipelinePage`, `MePage`.
  - `App.jsx`: PKCE auth flow with `initiateLogin`/`handleCallback`, protected routing, user context.
  - `lib/auth.js`: Zero-dependency PKCE implementation using Web Crypto API.
- Added `events_table_arn` output to `signal-bus` module (needed by dashboard-hosting).
- Wired all modules together in `infra/envs/dev/main.tf` — complete six-module integration.
Why (the reasoning, not just the diff):
- CloudFront + S3 is chosen over ECS/Fargate because the dashboard is static HTML/JS — no server needed, cost is effectively zero at rest, and it is fully destroyable.
- PKCE (not implicit flow) is required for SPAs per OAuth 2.0 Security Best Current Practice. No client secret is stored in the browser.
- API RBAC is enforced server-side by reading JWT claims, not client-side routing — the React role-gating is UX only.
- The dashboard reads real DynamoDB data from `prahari-platform-events` and `prahari-trust-scores`. Pipeline data is simulated until a CodeBuild webhook is added.
Files touched:
- `infra/modules/dashboard-hosting/main.tf`
- `infra/modules/dashboard-hosting/variables.tf`
- `infra/modules/dashboard-hosting/outputs.tf`
- `infra/modules/signal-bus/outputs.tf` (added events_table_arn)
- `services/dashboard-api/src/main.py`
- `dashboard/package.json`, `dashboard/vite.config.js`, `dashboard/index.html`
- `dashboard/src/main.jsx`, `dashboard/src/App.jsx`, `dashboard/src/index.css`
- `dashboard/src/lib/auth.js`, `dashboard/src/lib/config.js`
- `dashboard/src/components/Sidebar.jsx`, `dashboard/src/components/Widgets.jsx`
- `dashboard/src/pages/Pages.jsx`
- `infra/envs/dev/main.tf` (final integration of all 6 modules)
Open questions / next step:
- Before first deploy: populate `dashboard/.env.local` with `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_API_URL` from Terraform outputs.
- Optional stretch: Step 8 — `zt-eks` module (SPIFFE/SPIRE, Istio/Linkerd, OPA/Gatekeeper).
- All 7 planned modules are now code-complete.
