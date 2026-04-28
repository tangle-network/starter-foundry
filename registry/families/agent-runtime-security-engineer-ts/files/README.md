# Security Engineer Agent Bundle

## Overview
This bundle provides a security engineer advisory agent that helps with threat modeling, vulnerability triage, and security architecture review. It runs on the Tangle platform as a Cloudflare Worker.

## Capabilities
- **Threat Modeling**: Apply STRIDE to decompose threats per component.
- **Vulnerability Triage**: Assess and prioritize vulnerabilities using CVSS v3.1.
- **Security Architecture Review**: Evaluate system architecture for security gaps.

## Usage
Deploy to Tangle and interact via the `/api/chat` endpoint with a bearer token.

## Configuration
- `TANGLE_API_KEY`: Required for Tangle integration.
- `AGENT_NAME`: Set to `security-engineer`.

## Templates
- `templates/threat-modeling.md`
- `templates/vulnerability-triage.md`
- `templates/security-architecture-review.md`

## License
Proprietary.