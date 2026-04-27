# History Tutor Agent Runtime

A Cloudflare Worker agent that provides history tutoring: primary-source analysis, historiographic debate, and timeline reasoning.

## Features

- **Source Analysis**: Systematic analysis of primary sources using provenance, context, audience, bias, and corroboration.
- **Historiographic Debate**: Fair presentation of major interpretive schools and their arguments.
- **Timeline Reasoning**: Structured reasoning about causation, periodization, and counterfactuals.

## Setup

1. Install dependencies: `npm install`
2. Configure environment variables: `TANGLE_ROUTER_KEY`
3. Deploy: `npx wrangler deploy`

## Usage

Send chat requests to `/api/chat` with a Bearer token. Health check at `/api/health`.

## License
MIT
