# agent-runtime-product-manager-ts

Product management agent bundle — helps operators define product strategy, prioritize features, and run discovery cycles.

## Usage

Deploy as a Cloudflare Worker. The agent exposes two endpoints:
- `/api/chat` — main chat interface (bearer auth)
- `/api/health` — health check (no auth)

## Capabilities

- **product-strategy**: Define and pressure-test product strategy using Jobs-to-be-Done.
- **prioritization-framework**: Rank features with falsifiable hypotheses and kill criteria.
- **discovery-cycle**: Run structured user research to reduce risk before building.

## Configuration

Set the following environment variables:
- `TANGLE_ROUTER_KEY` — API key for Tangle router

## Files

- `system-prompt.md` — Agent system prompt
- `templates/` — Methodology templates
- `wrangler.toml` — Worker configuration

## License

MIT
