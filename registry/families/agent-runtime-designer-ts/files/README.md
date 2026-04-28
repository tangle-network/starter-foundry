# agent-runtime-designer-ts

Product design agent bundle — UX strategy, design critique, and prototyping guidance. Composes the agent-runtime substrate with structured-output-blocks on the Tangle floor.

## Capabilities

- **UX Strategy**: Define UX strategy aligned with user needs and business goals.
- **Design Critique**: Structured, actionable feedback based on usability heuristics.
- **Prototyping Guide**: Decide what to prototype and at what fidelity.

## Usage

Deploy as a Cloudflare Worker. Set `TANGLE_API_KEY` environment variable. The agent exposes two routes:
- `POST /api/chat` — main chat endpoint (bearer auth)
- `GET /api/health` — health check

## Templates

- `templates/ux-strategy.md`
- `templates/design-critique.md`
- `templates/prototyping-guide.md`

## License

MIT
