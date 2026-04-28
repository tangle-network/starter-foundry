# agent-runtime-game-designer-ts

Game designer agent bundle — designs game mechanics, narrative systems, and player experience loops.

## Features

- **Mechanic Design**: Design individual game mechanics using the MDA framework.
- **Narrative System Design**: Design branching plots, dialogue trees, and environmental storytelling.
- **Player Loop Design**: Design core and secondary player loops.

## Usage

Deploy as a Cloudflare Worker. The agent exposes two endpoints:

- `POST /api/chat` — Main chat endpoint (requires bearer token).
- `GET /api/health` — Health check.

## Configuration

Set the following environment variables:

- `TANGLE_API_KEY` — API key for Tangle router.

## Templates

- `templates/mechanic-design.md` — Mechanic design methodology.
- `templates/narrative-system.md` — Narrative system design methodology.
- `templates/player-loop.md` — Player loop design methodology.

## License

MIT
