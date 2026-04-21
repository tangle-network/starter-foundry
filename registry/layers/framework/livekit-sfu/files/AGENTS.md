# AGENTS.md — {{serviceName}} (LiveKit SFU)

This is a **self-hosted WebRTC SFU** starter. The LiveKit server runs in Docker; a
Node/Express control plane (`src/server.ts`) mints short-lived JWT access tokens so
browser clients can join rooms.

## Prerequisites

- Docker (or Docker Desktop)
- pnpm ≥ 9

## Commands

```bash
# Install dependencies
pnpm install

# Start the SFU + Redis sidecar (detached)
docker compose up -d

# Start the token-minting control plane (hot-reload)
pnpm dev

# Mint a token for a client
curl -X POST http://localhost:{{controlPort}}/token \
  -H 'Content-Type: application/json' \
  -d '{"room":"demo","identity":"alice"}'

# Check control-plane health
curl http://localhost:{{controlPort}}/health

# Typecheck without emitting files
pnpm exec tsc --noEmit

# Tear down Docker services
docker compose down
```

## Project structure

| Path | Purpose |
|------|---------|
| `src/server.ts` | Express token server — **only file you need to edit** for most features |
| `docker-compose.yml` | LiveKit SFU + Redis sidecar; uses `network_mode: host` for ICE |
| `livekit.yaml` | SFU config: ports, external-IP discovery, API key/secret, Redis address |
| `.env.example` | Copy to `.env` and fill in real credentials before deploying |
| `validate-livekit.mjs` | Structural smoke-test — run with `node validate-livekit.mjs` |

## First steps

1. Copy `.env.example` → `.env`. The dev defaults work locally; replace secrets for production.
2. `docker compose up -d` to start the SFU.
3. `pnpm dev` to start the control plane on port `{{controlPort}}`.
4. Mint a token and pass `token` + `wsUrl` to the browser's `livekit-client`:
   ```ts
   import { Room } from 'livekit-client'
   const room = new Room()
   await room.connect(wsUrl, token)
   ```

## Extending `src/server.ts`

- **Role-based access** — set `canPublish: false` in the `VideoGrant` for viewer-only identities.
- **Custom TTL** — pass `ttlSeconds` in the POST body (clamped to 60–86400 s).
- **Extra routes** — add REST endpoints above `app.listen`; keep token-signing logic in one place.
- **Auth middleware** — add `app.use(verifyJwt)` before the `/token` route to gate who can mint tokens.

## Critical rules

- `LIVEKIT_API_SECRET` must be **≥ 32 bytes**. The server throws at startup if shorter.
  Generate a safe value: `openssl rand -base64 32`
- The same key/secret pair must appear in **both** `.env` (control plane) **and** `livekit.yaml`
  under `keys:` (SFU). A mismatch causes 401s when clients try to join rooms.
- `getUserMedia` requires **HTTPS** outside `localhost` — clients cannot publish tracks over plain HTTP.
- The SFU uses `network_mode: host`; standard `ports:` mapping will not work for ICE/UDP traffic.
- Access tokens expire (default TTL 6 h). Clients must re-request before expiry or the WS upgrade is rejected.
