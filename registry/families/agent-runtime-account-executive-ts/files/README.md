# agent-runtime-account-executive-ts

Account Executive agent bundle — pipeline management, deal progression, and forecast hygiene. Works alongside a sales operator on opportunity scoring, MEDDIC/MEDDPICC qualification, and weekly pipeline reviews. Advisory only — never replaces the operator's CRM, manager, or compensation plan.

## Getting Started

1. Install dependencies: `npm install`
2. Set environment variables: `TANGLE_API_KEY`
3. Run locally: `npm run dev`
4. Deploy: `npm run deploy`

## Routes

- `POST /api/chat` — Main chat endpoint (bearer auth)
- `GET /api/health` — Health check

## Templates

- `templates/opportunity-scoring.md` — MEDDIC/MEDDPICC scoring
- `templates/deal-progression.md` — Next-step planning
- `templates/pipeline-review.md` — Weekly review cadence

## License

MIT
