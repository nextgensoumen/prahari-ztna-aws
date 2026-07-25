# Contributing to Prahari

Thank you for your interest in contributing to Prahari!

## Development Workflow

1. **Branch Naming**: Use semantic prefixes: `feat/`, `fix/`, `docs/`, `chore/`.
2. **Infrastructure Changes**: All Terraform changes must be tested in the `dev` environment first.
3. **Pull Requests**:
   - All PRs must pass the `security-scan.yml` and `infra-plan.yml` workflows.
   - Require at least one approving review before merging.
4. **Memory Log**: When completing a major feature, add an entry to the `memory/` directory to document the context and reasoning. Memory logs can be committed directly to `main`.

## Local Setup

- Install Terraform (>= 1.5.0)
- Install Node.js (>= 20)
- Configure AWS credentials (`aws configure sso`)

See the README for full deployment instructions.
