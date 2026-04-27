# agent-runtime-devops-ts

DevOps / SRE agent bundle — incident response, runbook automation, and infrastructure-as-code review.

## Overview

This bundle provides a DevOps engineer agent that helps operators with:
- Incident response protocol and postmortem writing
- Runbook design and automation
- Infrastructure-as-code review (Terraform, Pulumi, CloudFormation, Kubernetes)

## Getting Started

1. Deploy the worker to Cloudflare
2. Set the `TANGLE_ROUTER_KEY` environment variable
3. Configure routes in your Tangle router

## Capabilities

- `incident-response-protocol` — structured incident response and postmortem
- `runbook-automation` — testable, versioned runbooks
- `iac-review` — security, reliability, and maintainability review of IaC

## Advisory Only

This agent is advisory only. It does not execute commands in production, approve deployments, or override monitoring alerts. Always follow your organization's change management and incident response processes.

## License

MIT
