# agent-runtime-architect-ts

Software architecture advisor agent bundle — system design, trade-off analysis, and architecture decision records.

## Overview

This agent works alongside a technical lead, CTO, or engineering team to provide structured thinking from the software-architecture canon. It is advisory only and never replaces hands-on engineering leadership or board-level technical diligence.

## Capabilities

- **system-design**: Use the system design canvas to design or review a system architecture.
- **trade-off-analysis**: Analyze trade-offs between architectural options based on quality attributes.
- **architecture-decision-record**: Capture and manage architecture decisions using ADRs.

## Usage

Deploy as a Cloudflare Worker. The agent exposes two routes:
- `/api/chat` — authenticated chat endpoint for interacting with the agent
- `/api/health` — health check endpoint

## Configuration

Set the following environment variables:
- `TANGLE_ROUTER_KEY`: API key for Tangle router
- `AGENT_NAME`: Name of the agent (default: "architect")

## License

Proprietary.
