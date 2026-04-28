# agent-runtime-customer-success-ts

Customer Success Manager agent bundle — retention playbooks, health scoring, escalation triage, and QBR frameworks.

## Overview

This bundle provides a structured methodology for customer success operations. It composes the agent-runtime substrate with structured-output-blocks on the Tangle floor.

## Capabilities

- **retention-playbook**: Structured playbooks to identify at-risk customers and deploy interventions.
- **health-score**: Quantify customer health using leading and lagging indicators.
- **escalation-triage**: Triage customer escalations by severity.
- **qbr-framework**: Run structured Quarterly Business Reviews.

## Usage

Deploy as a Cloudflare Worker. Set `TANGLE_API_KEY` environment variable. The agent exposes:

- `POST /api/chat` — authenticated chat endpoint
- `GET /api/health` — health check

## Files

- `system-prompt.md` — Agent system prompt
- `templates/` — Methodology templates
- `wrangler.toml` — Worker configuration
- `README.md` — This file

## License

Proprietary.
