# `agent-base:secure` — in-process security helpers for sandbox-resident agent code

| | |
|---|---|
| **Status** | shipped |
| **Owner** | starter-foundry |
| **Surface** | files mounted into a Tangle sandbox via `AgentProfile.resources.files` (or auto-included when an agent bundle declares `includes: ["agent-base:secure"]`) |
| **Trust boundary** | the Tangle sandbox process itself; the gateway and OS sandbox handle isolation |

## What this layer is

A small set of TypeScript modules that the in-sandbox agent (OpenCode/Claude) can `import` and use inside its own code. Each module is a **footgun reducer**: it makes the right thing easy and the wrong thing loud, but it is **not** a security boundary on its own. The sandbox's process isolation, the gateway's TLS + identity injection, and `AgentProfile.permissions` are the actual boundaries.

The layer is shipped as files at `agent-base/secure/files/lib/secure/*.ts`. Bundles that include the layer get them mounted at `/workspace/lib/secure/` inside the sandbox.

## Modules

### `secrets`

Dotenvx-encrypted secret values. `SecureString` redacts itself in `console.log` / `JSON.stringify` / Sentry. `unsafeReveal(reason)` returns the raw value and audit-logs the call.

```ts
const apiKey = secrets.require('OPENAI_API_KEY')
fetch('https://api.openai.com/...', {
  headers: { Authorization: `Bearer ${apiKey.unsafeReveal('openai chat call')}` },
})
```

Resists accidental log leakage. Does **not** defend against an author who deliberately reveals + logs, or against heap dumps / debuggers.

### `workspace`

Path-traversal guard for agent code that constructs file paths from model output. Agent root frozen at first call.

```ts
const safe = workspace.resolve(userSuppliedRelativePath) // throws on `..` traversal
```

Sensitive-zone (`/sensitive/`) requires `'sensitive-fs'` capability on the agent's identity envelope.

### `webhook-in`

HMAC-SHA256 + `timingSafeEqual` + 5-min replay window + case-insensitive header lookup. For incoming callbacks from peer agents.

```ts
defineWebhook({
  path: '/api/peer-event',
  secretName: 'PEER_HMAC_SECRET',
  schema: validatePayload,
  handler: async (body, { sender }) => { ... },
})
```

Within the 5-min window, the same signed payload validates more than once (no nonce dedup). Operators that need stricter replay protection plug a seen-nonce store at the schema-validate step.

### `webhook-out`

HMAC-SHA256 signing + exponential-backoff retry (max 3) + per-host circuit breaker + `allowedDomains` whitelist. For outgoing calls to peer agents.

```ts
await webhookOut.send({
  url: 'https://peer.tangle.tools/inbox',
  body: { event: 'filing-ready', id: 'F-123' },
  secretName: 'PEER_HMAC_SECRET',
})
```

The whitelist is enforced inside this function only. Bundles that bypass and call `fetch()` directly hit whatever the OS sandbox + `AgentProfile.permissions.network` allows.

### `schedule`

Cron-handler registry with syntax validation.

```ts
schedule.register('cron-key', '0 9 * * *', async () => { ... })
```

Wiring only. The runtime dispatcher (sandbox-side) calls `schedule._fire(key)` on the cadence.

### `identity`

Typed envelope read from `TANGLE_AGENT_IDENTITY_JSON`:

```ts
const id = identity.current()
// { agentId, sessionId, deployerId, signedAt, expiresAt, capabilities, publicKey, signature }
```

Fail-closed: missing or expired envelope throws. Dev opt-in via `SF_DEV_IDENTITY_OPTIN=1` returns a synthetic envelope with no capabilities.

The gateway is the trust boundary that authenticates the envelope; this module does not verify the signature in-process.

### `audit`

SHA256 hash chain with canonical-JSON serialization. Locally-verifiable tamper-evident record.

```ts
audit.log({ event: 'doc.read', target: 'client-X' })
const result = audit.verifyDay('2026-04-27') // → { ok: true } or { ok: false, tamperedAtSeq: N }
```

Fail-closed actor resolution (audit refuses to write a line it can't attribute). The chain detects tampering on export, not in real time — the agent process has write access to its own log file. Production deploys export to an external sink within the operator's attestation window.

## What this layer does NOT do

- **Identity signature verification.** `identity.verify()` throws "not implemented" — the deployer-pubkey directory lives at the gateway. Calling `verify()` in-process would lie about cryptographic verification.
- **Real-time audit immutability.** The chain proves tampering on export. Real-time tamper-prevention belongs to the sandbox's structured-logging pipeline.
- **Egress enforcement.** `webhook-out` is a convenience wrapper. Network policy is `AgentProfile.permissions.network` + the OS sandbox's `allowedDomains`.
- **Memory-resident secret protection.** `SecureString` reduces accidental leakage; it is not memory-safe against process-level attackers.
- **Side-channel defense.** Timing, cache, etc. — out of scope.

## Tests

`agent-base/secure/files/lib/secure/index.test.ts` — covers every documented guarantee, with regression cases for the auditable paths (canonical-JSON stability, fail-closed identity/secrets/audit, HMAC + replay, frozen workspace root).

## Cross-references

- `docs/architecture/agent-bundles.md` — the deploy model that puts these modules into a sandbox
- `docs/cookbooks/deploy-agent-runtime-research.md` — single-agent path
- `docs/cookbooks/deploy-multi-agent-startup-team.md` — multi-agent path
- `agent-base:privacy` — sibling layer for PII redaction; included in high-stakes bundles only
