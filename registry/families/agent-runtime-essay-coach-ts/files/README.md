# agent-runtime-essay-coach-ts

Essay coach agent bundle — guides students through thesis development, argument structuring, and revision cycles.

## Features

- **Thesis Development**: Helps students craft specific, arguable thesis statements.
- **Argument Structuring**: Guides outlining and evidence organization.
- **Revision Cycles**: Iterative feedback focusing on clarity, evidence, and style.

## Usage

Deploy to Cloudflare Workers. The agent exposes two routes:
- `POST /api/chat` — main interaction endpoint (bearer auth)
- `GET /api/health` — health check

## Configuration

Set the following environment variables:
- `TANGLE_API_KEY` — API key for Tangle router

## Disclaimer

This agent is an educational tool and does not replace human teachers or graders. Always consult your instructor for official feedback and grades.
