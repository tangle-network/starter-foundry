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
A small set of in-process TypeScript helpers every agent-runtime bundle inherits via `includes: ["agent-base:secure"]`. The primitives sit on top of two layers we trust:

1. **OS sandbox** (sandbox-sdk): process isolation, `noNewPrivileges`, `capDrop:ALL`, network-egress whitelist via `client.create({ allowedDomains: [...] })`
2. **Tangle gateway**: TLS termination, request routing, identity verification, rate limits

Every primitive is in-process; none are network services. The layer ships as files mounted via `AgentProfile.resources.files` (or auto-included when a family declares `includes: ["agent-base:secure"]`), and the in-sandbox agent imports them as a normal module.

This layer is **a fail-closed footgun reducer that makes accidents loud** — not a standalone security boundary. The sandbox boundary and the gateway are the trust boundaries.

## Primitives

| Primitive | Purpose |
|---|---|
| `SecureString` / `secrets` | dotenvx-encrypted-at-rest façade. Refuses to return values that look like un-decrypted ciphertext. `SecureString` returns `[REDACTED]` from `toString()`/`toJSON()`. Reveal call audit-logs. |
| `workspace` | Path-traversal guard via `path.relative()` against the agent root. Agent root is frozen at first call so mutating env after that does not change effective root. Sensitive-zone (`/sensitive/`) requires `'sensitive-fs'` capability on the agent's identity. |
| `webhook-in` | HMAC-SHA256 + `timingSafeEqual`, 5-min replay window via signed timestamp inside MAC scope, schema validation runs after MAC verify, case-insensitive header lookup. |
| `webhook-out` | HMAC-SHA256 outbound signature, retry with exponential backoff (max 3), circuit breaker per host (open after 5 failures, 60s cooldown). Convenience around `fetch()` for code inside the sandbox; the OS sandbox's `allowedDomains` is the actual egress boundary. |
| `schedule` | Capability-handler registry with cron-syntax validation. The runtime dispatcher calls `schedule._fire()`; the layer is wiring, not a scheduler. |
| `identity` | Typed envelope `{ agentId, sessionId, deployerId, signedAt, expiresAt, capabilities, publicKey, signature }` injected via `TANGLE_AGENT_IDENTITY_JSON`. Fail-closed when missing — requires explicit `SF_DEV_IDENTITY_OPTIN=1` for dev fallback, and dev fallback grants no capabilities. |
| `audit` | SHA256 hash chain with canonical JSON (keys sorted before hash so chain integrity is stable across V8 versions and clones). `verifyDay()` detects after-the-fact tampering. Locally-verifiable; the sandbox's structured logging + gateway audit pipeline are the source of truth for tamper-evident retention. |

## Threat model

**Defends against:**

1. Webhook spoofing across agent-to-agent traffic (HMAC + replay window)
2. Workspace path-traversal from a buggy bundle
3. Misconfigured production silently granting privileged access (fail-closed pattern across identity + audit + secrets)
4. Returning ciphertext as plaintext when dotenvx didn't decrypt
5. Audit-log tampering becoming undetectable on export

**Does NOT defend against — and does NOT pretend to:**

- **Cryptographic identity verification.** `identity.verify()` is a thin assertion that the env var is well-formed and unexpired. Real identity verification is the sandbox-sdk + Tangle gateway's responsibility; the gateway injects `TANGLE_AGENT_IDENTITY_JSON` and the agent loop trusts it because the sandbox boundary is the trust boundary.
- **Real-time audit-log tamper prevention.** The hash chain detects tampering on export only. The agent's process can `unlinkSync` or rewrite the local log file at runtime; the chain catches it when an external sink reads the log and re-verifies.
- **Egress control on raw `fetch()`/`node:http`.** Bundles that bypass `webhook-out` and call `fetch()` directly hit any URL the OS sandbox allows. Egress whitelisting is the OS sandbox's job.
- **Memory-resident secret protection.** `SecureString` resists accidental leakage through `console.log` / `JSON.stringify` / Sentry. It does not defend against debuggers, heap dumps, or any attacker with process-memory access.
- **Gateway compromise** (TLS terminates upstream; we trust it).
- **Host kernel compromise** (sandbox-sdk handles host-level isolation).
- **Bundle author who deliberately reveals secrets** via `unsafeReveal()` then logs them — audit logs the reveal call, operator policy decides what to do.
- **Side-channel attacks** (timing, cache) — out of scope.
- **Operator who sets `SF_DEV_IDENTITY_OPTIN=1` in production** — explicit opt-in is the audit signal; if it's wrong, the operator chose wrong.

## Operator responsibilities

When you deploy a bundle that includes `agent-base:secure`:

1. **Provision Ed25519 identity keypair** + ensure the gateway injects `TANGLE_AGENT_IDENTITY_JSON` at session start. Without it, the layer fails-closed.
2. **Encrypt secrets via dotenvx**: `dotenvx encrypt .env --key <pubkey>`. Set `DOTENV_PRIVATE_KEY` in the runtime environment. Without it, the layer fails-closed on first secret read.
3. **Configure gateway-side** TLS, allowedDomains, quotas — the layer trusts the gateway.
4. **Periodically export `/workspace/<agent-id>/.audit/` off-host** for compliance retention; verify the chain via `audit.verifyDay(date)` post-export.
5. **In dev / test only**: set `SF_DEV_IDENTITY_OPTIN=1` to enable the synthetic identity fallback. Doing this in production is operator policy choice and is itself the audit trail.

## Composition

```
agent-base:tangle              ← Tangle SDK + sandbox + router (lower layer)
  └── agent-base:secure        ← THIS layer (in-process primitives)
        ├── secrets.ts          (dotenvx façade + SecureString)
        ├── workspace.ts        (sandboxed FS + sensitive-zone ACL + frozen root)
        ├── webhook-in.ts       (HMAC verify + replay window)
        ├── webhook-out.ts      (HMAC sign + retry + circuit breaker)
        ├── schedule.ts         (cron-handler registry)
        ├── identity.ts         (typed envelope + fail-closed dev fallback)
        └── audit.ts            (canonical-JSON hash chain)
```

Resists accidental log leakage. Does **not** defend against an author who deliberately reveals + logs, or against heap dumps / debuggers.

### `workspace`

Path-traversal guard for agent code that constructs file paths from model output. Agent root frozen at first call.
`files/lib/secure/index.test.ts` covers every primitive:

- secrets: dotenvx ciphertext detection, SecureString redaction, cache behavior
- workspace: path-traversal rejection, frozen-root invariant, sensitive-zone capability check
- webhook-in: HMAC verification, replay-window rejection, case-insensitive headers, schema gate
- webhook-out: HMAC signing, circuit breaker
- audit: canonical-JSON stability, chain integrity, verifyDay tamper detection
- identity: fail-closed default, dev opt-in synthetic identity, expiry check

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
## Adjacent concerns

- **PII content policy.** `agent-base:privacy` ships as a sibling layer wired into the 6 high-stakes bundles (`legal-counsel`, `tax`, `wealth-manager`, `auditor`, `recruiter`, `doctor`) via `manifest.json` `includes`. Low-stakes bundles opt out by default; they don't sit on a regulated-PII egress path, so the cost (added compose-time files, runtime check overhead) is not justified.
- **High-stakes structural disclaimers.** Reframed as `AgentProfile.permissions` policy + orchestrator instructions (e.g. CFO-advisor's `notALicensedAdvisor: true` metadata + a refusal-pattern instruction). Enforcement is the in-sandbox agent's policy compliance.

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
- [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) — the bundle architecture, end-to-end.
- [`docs/cookbooks/deploy-agent-runtime-research.md`](../cookbooks/deploy-agent-runtime-research.md) — single-agent deploy path.
- [`docs/cookbooks/deploy-multi-agent-startup-team.md`](../cookbooks/deploy-multi-agent-startup-team.md) — multi-agent path.
- `agent-base:privacy` — PII detection + redaction layer.
- RFC `docs/specs/rfc-tangle-pii-egress-controls.md` — platform-side gateway scanner + sandbox-runtime log filter.
