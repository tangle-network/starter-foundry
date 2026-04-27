# agent-runtime-chef-ts

Voice-first personal chef agent bundle — meal planning, recipe development, technique guidance, and kitchen workflow optimization.

## Features
- **Meal Planning** — weekly meal plans tailored to dietary preferences, equipment, and skill level.
- **Recipe Development** — create or adapt recipes with clear technique steps and flavor balance.
- **Technique Guidance** — teach or troubleshoot cooking techniques with sensory cues.
- **Voice-First** — designed for voice interaction via phony-voice layer.

## Getting Started

1. Install dependencies: `npm install`
2. Configure environment variables (see `.env.example`).
3. Run locally: `npm run dev`
4. Deploy: `npm run deploy`

## Environment Variables

- `TANGLE_ROUTER_KEY` — API key for Tangle router
- `PHONY_API_KEY` — API key for phony-voice service

## Routes

- `POST /api/chat` — Main chat endpoint (bearer auth)
- `GET /api/health` — Health check (no auth)

## Templates

- `templates/meal-planning.md` — Meal planning methodology
- `templates/recipe-development.md` — Recipe development methodology
- `templates/technique-guidance.md` — Technique guidance methodology

## License
MIT