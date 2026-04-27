# `agent-base:secure`

Security floor for every agent-runtime bundle. Composes `agent-base:tangle` and is included by every bundle in the catalog.

## What you get for free

By including `agent-base:secure` in your manifest's `includes[]`, your agent inherits:

- **`secrets`** — dotenvx-backed encrypted secrets, loaded as `SecureString` (resists accidental leakage to logs)
- **`workspace`** — sandboxed `/workspace/<agent-id>/` with path-traversal protection + sensitive-zone ACL
- **`webhook-in`** — HMAC-signed inbound webhooks with replay-window + schema validation
- **`webhook-out`** — HMAC-signed outbound posts with retry + circuit breaker + outbound URL whitelist
- **`schedule`** — declarative scheduled triggers from `manifest.defaults.schedule[]`
- **`identity`** — Ed25519 ephemeral signed identity (TTL ≤ 1h, auto-rotated)
- **`audit`** — append-only signed audit log per agent

## Usage from a bundle

Bundles import via the `agent-base:secure` namespace; the layer composes the modules into `src/lib/secure/`.

```ts
import { secrets, workspace, schedule, defineWebhook, webhookOut } from '@/lib/secure'

// Secret
const apiKey = secrets.require('PHONY_API_KEY')
await fetch('https://api.tangle.tools/...', {
  headers: { authorization: `Bearer ${apiKey.unsafeReveal('phony API call')}` },
})

// Workspace
workspace.write('drafts/draft-1.md', '# hello')
const draft = workspace.read('drafts/draft-1.md')

// Inbound webhook
defineWebhook({
  path: '/pt-session-ingest',
  secretName: 'PT_INGEST_HMAC',
  schema: (b) => (typeof (b as { patientId?: string }).patientId === 'string' ? null : 'patientId required'),
  handler: async (body, ctx) => {
    workspace.write(`sensitive/inbound/${(body as { patientId: string }).patientId}/${ctx.receivedAt}.json`, JSON.stringify(body))
  },
})

// Outbound webhook
const result = await webhookOut(
  'https://doctor.tangle.tools/pt-session-ingest',
  { patientId: 'p-123', notes: '...' },
  { secretName: 'PT_INGEST_HMAC', allowedDomains: ['doctor.tangle.tools'] },
)

// Scheduled trigger (manifest declares the cron + capability)
schedule.on('morning-summary', async () => {
  // The runtime dispatches here when the cron fires
})
```

## Manifest declarations the layer reads

```json
{
  "includes": ["agent-base:tangle", "agent-base:secure", "agent-output:blocks"],
  "defaults": {
    "secrets":          ["PHONY_API_KEY", "PT_INGEST_HMAC"],
    "outboundDomains":  ["api.tangle.tools", "doctor.tangle.tools"],
    "schedule": [
      { "id": "morning-summary", "cron": "0 8 * * *", "capability": "morning-summary" }
    ],
    "webhooks": {
      "in": [{ "path": "/pt-session-ingest", "schema": "schemas/pt-session.json", "capability": "ingest-pt-session" }]
    }
  }
}
```

## Operator responsibilities

The layer is the floor — it is NOT the ceiling. The operator must:

1. **Provision Ed25519 identity keypair** + populate `DOTENV_PRIVATE_KEY` for the runtime
2. **Encrypt secrets** via `dotenvx encrypt .env --key <pubkey>` before checkin (never plaintext)
3. **Configure gateway TLS + allowedDomains + quotas** — the layer trusts the gateway
4. **Periodically export `/workspace/<agent-id>/.audit/`** to an off-host store for compliance retention
5. **Verify the audit chain** post-export via `audit.verifyDay(date)`

## Threat model + non-goals

See `docs/specs/agent-base-secure.md` for the full threat model + the explicit list of attacks the layer does NOT defend against (compromised gateway, compromised host kernel, side-channel, malicious operator).

## When you should NOT use this layer

- A bundle that does not need any persistent state, secrets, scheduling, or external traffic. Rare.
- A bundle that is the gateway/router itself (would create a circular trust assumption).
- Test fixtures.

For everything else, include it. The cost of inclusion is one line in `manifest.includes`. The cost of NOT including it is re-implementing security primitives 50 times.
