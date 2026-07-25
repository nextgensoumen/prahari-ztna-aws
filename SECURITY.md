# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v0.1.x  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within Prahari, please do NOT open a public issue. Instead, send an email to the project maintainers or use GitHub Security Advisories to report it privately.

We aim to respond to all vulnerability reports within 48 hours.

## Security Posture

- **No Long-Lived Credentials**: CI/CD uses GitHub OIDC.
- **Least Privilege**: All IAM roles in this project follow strict least-privilege.
- **Zero Trust**: Network access is gated by identity (Cognito + Verified Access).
