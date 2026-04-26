# `agent-base:secure` — shared security primitives for agent-runtime bundles

| | |
|---|---|
| **Status** | shipped, post-audit revision |
| **Owner** | starter-foundry |
| **Threat model** | untrusted bundle code running inside a Tangle sandbox; the layer is in-process logic atop the OS sandbox + gateway TLS |

## What this layer actually is

A small set of in-process TypeScript primitives every agent-runtime bundle inherits via `includes: ["agent-base:secure"]`. The primitives sit on top of two layers we trust:

1. **OS sandbox** (sandbox-sdk): process isolation, `noNewPrivileges`, `capDrop:ALL`, network-egress whitelist
2. **Tangle gateway**: TLS termination, request routing, identity verification, rate limits

This layer adds: HMAC verification on agent-to-agent traffic, an append-only signed audit log, a workspace sandboxing wrapper, a typed identity passthrough, a dotenvx secrets façade, and a schedule-handler registry. **It is NOT a replacement for the OS sandbox or the gateway. It is a thin in-process layer that makes them easier to use correctly.**

## Honest guarantees per primitive

Each row reports what the code actually does (line refs to `files/lib/secure/*.ts`). Anything not in the "Guarantee" column is NOT guaranteed.

| Primitive | Guarantee | NOT guaranteed |
|---|---|---|
| **secrets** | dotenvx-encrypted at rest (real crypto, dotenvx does it). Refuses to return values that look like un-decrypted ciphertext (H1 fix). `SecureString` returns `[REDACTED]` from `toString()`/`toJSON()`. Reveal call audit-logs. `clearCache()` drops cached references. | Memory-shred of `SecureString` instances already handed out (call-site holds a reference). Defense against an author who deliberately calls `unsafeReveal()` then logs the raw string. |
| **workspace** | Path-traversal check via `path.relative()` against agent root. Agent root **frozen at first call** (H2 fix) — mutating env after that does not change effective root. Sensitive-zone (`/sensitive/`) requires `'sensitive-fs'` capability on the agent's identity. | OS-level FS isolation (the sandbox does that). Disk-quota enforcement (operator/runtime concern; not implemented). |
| **webhook-in** | HMAC-SHA256 + `timingSafeEqual`, 5-min replay window via signed timestamp inside MAC scope, schema validation runs after MAC verify, case-insensitive header lookup (H4 fix). | Per-nonce replay dedup within the 5-min window (would require a seen-nonce store). Constant-time secret-name lookup (LOW finding, deferred). |
| **webhook-out** | HMAC-SHA256 outbound signature, retry with exponential backoff (max 3), circuit breaker per host (open after 5 failures, 60s cooldown), outbound-URL whitelist via `allowedDomains`. | Egress block if the bundle bypasses this function and calls `fetch()` directly (the OS sandbox's `allowedDomains` is the actual boundary). |
| **schedule** | Capability-handler registry with cron-syntax validation. | At-least-once delivery (runtime concern; not implemented). Retry policy on handler failure (runtime concern; not implemented). The runtime dispatcher must call `schedule._fire()`; the layer is wiring, not a scheduler. |
| **identity** | Typed envelope `{ agentId, sessionId, deployerId, signedAt, expiresAt, capabilities, publicKey, signature }` injected via `TANGLE_AGENT_IDENTITY_JSON`. **Fail-closed when missing** (H3 fix) — requires explicit `SF_DEV_IDENTITY_OPTIN=1` for dev fallback, and dev fallback grants no capabilities. | Ed25519 signature verification in-process (the gateway is the trust boundary; in-process `verify()` only checks expiry + presence of signature). Cross-agent call non-forgeability (depends on the gateway honoring its identity contract). |
| **audit** | SHA256 hash chain with **canonical JSON** (M1 fix — keys sorted before hash so chain integrity is stable across V8 versions and clones). `verifyDay()` detects after-the-fact tampering. **Fail-closed actor resolution** (M2 fix). | Real-time write prevention (the agent's process can `unlinkSync` or `writeFileSync` over the log; chain detects, doesn't prevent). Cross-host replication (operator must export the chain off-host for compliance review). |

## Threat model

**Defends against:**
1. Webhook spoofing across agent-to-agent traffic (HMAC + replay window)
2. Workspace path-traversal from a buggy bundle
3. Misconfigured production silently granting privileged access (H3 fail-closed pattern across identity + audit + secrets)
4. Returning ciphertext as plaintext when dotenvx didn't decrypt (H1)
5. Audit-log tampering becoming undetectable (chain + canonical JSON)

**Does NOT defend against:**
- Compromised gateway (TLS terminates upstream; we trust it)
- Compromised host kernel (sandbox-sdk handles host-level isolation)
- Bundle author who deliberately reveals secrets via `unsafeReveal()` then logs them (audit logs the reveal; operator policy)
- Side-channel attacks (timing, cache) — out of scope
- Operator who sets `SF_DEV_IDENTITY_OPTIN=1` in production (explicit opt-in is the audit signal; if it's wrong, the operator chose wrong)
- Agent code that calls `node:fs`, `node:http`, etc. directly to bypass the layer (the OS sandbox is the actual enforcement)

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
        ├── webhook-out.ts      (HMAC sign + retry + circuit breaker + URL whitelist)
        ├── schedule.ts         (cron-handler registry)
        ├── identity.ts         (typed envelope + fail-closed dev fallback)
        └── audit.ts            (canonical-JSON hash chain)
```

Bundles include the layer; methodology guides reference primitives by name.

## Test coverage

`files/lib/secure/index.test.ts` covers every guarantee in the table above:
- secrets: dotenvx ciphertext detection, SecureString redaction, cache behavior
- workspace: path-traversal rejection, frozen-root invariant, sensitive-zone capability check
- webhook-in: HMAC verification, replay-window rejection, case-insensitive headers, schema gate
- webhook-out: HMAC signing, allowedDomains enforcement, circuit breaker
- audit: canonical-JSON stability, chain integrity, verifyDay tamper detection
- identity: fail-closed default, dev opt-in synthetic identity, expiry check

## Implementation notes

- All primitives are pure TS modules. No daemons. No background threads.
- Module-level state is documented and reset-for-test escape hatches exist (`workspace._resetForTest()`, `secrets.clearCache()`).
- `audit.log()` is the only write path for the chain; it is called internally by every other primitive that does a privileged action.
- Per-secret-reveal audit entries can be high-frequency on hot-path code (webhook-in/out call `unsafeReveal()` once per request). Operators concerned with audit volume should consider per-process secret caching (already done) and review the audit retention policy.

## Related

- `agent-base:privacy` — PII detection + redaction at intentional egress points (separate layer; composes with this one)
- RFC `docs/specs/rfc-tangle-pii-egress-controls.md` — platform-side gateway scanner + sandbox-runtime log filter (out of scope for this layer)
