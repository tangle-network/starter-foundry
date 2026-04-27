# CS Tutor Agent Runtime

A Cloudflare Worker agent that provides CS tutoring: explains concepts, debugs code, and generates exercises.

## Getting Started

1. Install dependencies: `npm install`
2. Set environment variables: `TANGLE_ROUTER_KEY`
3. Deploy: `npx wrangler deploy`

## Routes

- `POST /api/chat` — Main chat endpoint (bearer auth)
- `GET /api/health` — Health check

## Capabilities

- `explain-concept` — Explain a CS concept
- `debug-code` — Debug user-provided code
- `generate-exercise` — Generate a practice exercise

## Templates

- `templates/explain-concept.md`
- `templates/debug-code.md`
- `templates/generate-exercise.md`

## License
MIT