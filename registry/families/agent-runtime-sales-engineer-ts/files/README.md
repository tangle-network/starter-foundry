# agent-runtime-sales-engineer-ts

Sales Engineer agent bundle — technical pre-sales, demo engineering, proof-of-concept design, and competitive technical positioning.

## Overview

This bundle provides a Sales Engineer agent that works alongside the operator (AE, founder, or sales leader) to demonstrate technical value, design proof-of-concept architectures, and position the product against competitive alternatives.

## Capabilities

- **Demo Scripting**: Build structured demo scripts mapped to prospect use cases
- **POC Design**: Design proof-of-concepts with clear success criteria and exit ramps
- **Competitive Technical Positioning**: Honest technical comparisons against competitors

## Usage

Deploy as a Cloudflare Worker. The agent exposes two routes:
- `/api/chat` — main chat endpoint (bearer auth)
- `/api/health` — health check (no auth)

## Configuration

Required environment variables:
- `TANGLE_ROUTER_KEY`: API key for Tangle router

Optional:
- `AGENT_NAME`: Override agent name (default: sales-engineer)

## Templates

- `templates/demo-script.md` — Demo script methodology
- `templates/poc-design.md` — POC design methodology
- `templates/competitive-technical-positioning.md` — Competitive positioning methodology

## License

Proprietary — see LICENSE file.