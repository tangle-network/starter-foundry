# `agent-base:secure` — shared security primitives for agent-runtime bundles

| | |
|---|---|
| **Status** | shipped |
| **Owner** | starter-foundry |
| **Threat model** | untrusted bundle code running inside a Tangle sandbox; the layer is in-process logic atop the OS sandbox + gateway TLS |

## What this layer is

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

Bundles include the layer; methodology guides reference primitives by name.

## Test coverage

`files/lib/secure/index.test.ts` covers every primitive:

- secrets: dotenvx ciphertext detection, SecureString redaction, cache behavior
- workspace: path-traversal rejection, frozen-root invariant, sensitive-zone capability check
- webhook-in: HMAC verification, replay-window rejection, case-insensitive headers, schema gate
- webhook-out: HMAC signing, circuit breaker
- audit: canonical-JSON stability, chain integrity, verifyDay tamper detection
- identity: fail-closed default, dev opt-in synthetic identity, expiry check

## Implementation notes

- All primitives are pure TS modules. No daemons. No background threads.
- Module-level state is documented and reset-for-test escape hatches exist (`workspace._resetForTest()`, `secrets.clearCache()`).
- `audit.log()` is the only write path for the chain; it is called internally by every other primitive that does a privileged action.
- Per-secret-reveal audit entries can be high-frequency on hot-path code (webhook-in/out call `unsafeReveal()` once per request). Operators concerned with audit volume should consider per-process secret caching (already done) and review the audit retention policy.

## Adjacent concerns

- **PII content policy.** `agent-base:privacy` ships as a sibling layer wired into the 6 high-stakes bundles (`legal-counsel`, `tax`, `wealth-manager`, `auditor`, `recruiter`, `doctor`) via `manifest.json` `includes`. Low-stakes bundles opt out by default; they don't sit on a regulated-PII egress path, so the cost (added compose-time files, runtime check overhead) is not justified.
- **High-stakes structural disclaimers.** Reframed as `AgentProfile.permissions` policy + orchestrator instructions (e.g. CFO-advisor's `notALicensedAdvisor: true` metadata + a refusal-pattern instruction). Enforcement is the in-sandbox agent's policy compliance.

## Related

- [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) — the bundle architecture, end-to-end.
- [`docs/cookbooks/deploy-agent-runtime-research.md`](../cookbooks/deploy-agent-runtime-research.md) — single-agent deploy path.
- [`docs/cookbooks/deploy-multi-agent-startup-team.md`](../cookbooks/deploy-multi-agent-startup-team.md) — multi-agent path.
- `agent-base:privacy` — PII detection + redaction layer.
- RFC `docs/specs/rfc-tangle-pii-egress-controls.md` — platform-side gateway scanner + sandbox-runtime log filter.
