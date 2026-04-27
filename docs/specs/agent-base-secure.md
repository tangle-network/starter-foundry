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
5. Audit-log tampering becoming undetectable on export (chain + canonical JSON)

**Does NOT defend against — and does NOT pretend to:**
- **Cryptographic identity verification.** `identity.verify()` is **not implemented** and throws when called. The Ed25519 deployer-pubkey directory ships with the gateway service; until that's deployed, calling `verify()` is wrong and the method makes that loud. `identity.current()` returns whatever the gateway puts in `TANGLE_AGENT_IDENTITY_JSON` — anyone with env-write becomes any agent until the verify path is live.
- **Real-time audit-log tamper prevention.** The hash chain detects tampering **on export only**. The agent's process can `unlinkSync` or rewrite the local log file at runtime; the chain catches it when an external sink reads the log and re-verifies. Operators must export off-host on a cadence shorter than their attestation window.
- **Egress control on raw `fetch()`/`node:http`.** Bundles that bypass `webhook-out` and call `fetch()` directly hit any URL the OS sandbox allows. Egress whitelisting is the OS sandbox's job; this layer does not enforce it.
- **Memory-resident secret protection.** `SecureString` resists accidental leakage through `console.log` / `JSON.stringify` / Sentry. It does NOT defend against debuggers, heap dumps, or any attacker with process-memory access. `secrets.clearCache()` clears the cache map; it does not zero the underlying string in V8.
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

## What's NOT yet built (load-bearing infrastructure)

These are real gaps, not minor. Read this before treating the layer as "production-secure":

1. **Gateway pubkey directory + Ed25519 verify path.** Required for `identity.verify()` to do anything useful. Currently throws on call. Status: spec'd, not built.
2. **External audit sink** (append-only ledger or signed S3 + immutable retention). Required for the hash chain to be tamper-evident in real time. Currently the chain is local-filesystem and operator must export. Status: design TBD.
3. **Egress controller at SDK boundary.** Required to make `webhook-out` mandatory rather than aspirational. Currently bundles can `fetch()` directly. Status: depends on sandbox-sdk's network policy primitives.
4. **`agent-base:privacy` wired into bundles.** Partially wired: the 6 high-stakes bundles (`legal-counsel`, `tax`, `wealth-manager`, `auditor`, `recruiter`, `doctor`) now `include` it in `manifest.json` because they routinely handle SSNs, account numbers, candidate PII, and PHI. Low-stakes bundles still opt out by default — they don't sit on a regulated-PII egress path, so the cost (added compose-time files, runtime check overhead) is not justified. Status: high-stakes wiring shipped; low-stakes opt-out is the deliberate policy.
5. **High-stakes structural disclaimer enforcement.** Bundles like `legal-counsel`, `wealth-manager`, `tax`, `auditor` carry frontmatter disclaimer language and `:::escalation` block grammar — but enforcement is LLM-following-instructions, not structural. Status: needs a downstream gate (refuse to render actionable advice without escalation block).

Each of these is in the layer's roadmap. Until they ship, treat the layer as **a fail-closed footgun reducer that makes accidents loud** — not a security boundary.

## Architectural correction (v0.11.0)

The v0.10.x version of this spec listed five "load-bearing infrastructure" gaps (gateway pubkey directory, external audit sink, egress controller, privacy-layer wiring, structural disclaimer enforcement). Most of those flip status under the corrected agent-bundle model. See [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) for the full architectural shift; the relevant mapping:

| Prior gap | Status under v0.11.0 |
|---|---|
| Gateway Ed25519 pubkey directory + `identity.verify()` | **N/A in this layer.** Identity verification is the sandbox-sdk + Tangle gateway's responsibility. The gateway injects `TANGLE_AGENT_IDENTITY_JSON`; the agent loop trusts it because the sandbox boundary is the trust boundary. The in-process `identity.verify()` becomes a thin assertion that the env var is well-formed and unexpired — no in-process pubkey directory needed. |
| External audit sink | **Moved to sandbox-side.** The sandbox's structured logging + the gateway's audit pipeline are the source of truth. The hash-chain primitive here becomes an *in-process helper* an agent's own code can call when it needs an additional locally-verifiable record (e.g. for an artifact requested by a `:::escalation` block). It is no longer trying to be a standalone audit system. |
| Egress controller at SDK boundary | **N/A in this layer.** `client.create({ allowedDomains: [...] })` and the OS sandbox's network-egress whitelist are the actual boundary. `webhook-out` becomes a convenience wrapper around `fetch()` for code inside the sandbox; bundles that bypass it just hit whatever the SDK-level egress allows. |
| `agent-base:privacy` wired into bundles | **Still relevant** — PII redaction is content-policy logic, not infrastructure. Continues to ship in the 6 high-stakes bundles' `includes[]`. |
| Structural disclaimer enforcement | **Still relevant** — reframed as `AgentProfile.permissions` policy + orchestrator instructions (e.g. CFO-advisor's `notALicensedAdvisor: true` metadata + a refusal-pattern instruction). Enforcement is the in-sandbox agent's policy compliance, not an external gate. |

### What `agent-base:secure` is in v0.11.0

A small set of **in-process TypeScript helpers** that code running **inside a Tangle sandbox** can use:

- `SecureString` — protect against accidental `console.log` / Sentry leakage of secret values inside the agent's own code.
- `audit.log()` / `audit.verifyDay()` — locally-verifiable hash chain when the agent itself wants to keep a tamper-evident record of its actions.
- `workspace` path-traversal helper — a defensive guard for agent code that constructs file paths from model output.
- `webhook-in` HMAC verifier — when the agent receives a callback from another in-sandbox or peer agent.
- `webhook-out` HMAC signer + retry/circuit-breaker — convenience around the agent's `fetch()` calls to peers.
- `schedule` cron-handler registry — when the agent runs a recurring job inside its sandbox.

Every primitive is in-process; none are network services. The layer ships as files mounted via `AgentProfile.resources.files` (or auto-included when a family declares `includes: ["agent-base:secure"]`), and the in-sandbox agent imports them as a normal module.

### What's removed

- The **"platform pretense"** wrapping packs in a custom server (the v0.10.x premise behind PRs #85, #86, #87) is gone. There is no `agent-platform-ts` worker reading `agent-roster.json`. There is no `agent-orchestrator-service-ts` Hono app dispatching `:::handoff` blocks. Both wrong-abstraction families are being removed by the sister-agent track; this spec stops referencing them as runtime substrate.
- The "external audit sink" design TBD is no longer this layer's problem; if it's anyone's, it's the sandbox/gateway's.
- The "egress controller at SDK boundary" gap is closed by sandbox-sdk's own `allowedDomains`.

### Cross-references

- [`docs/architecture/agent-bundles.md`](../architecture/agent-bundles.md) — the corrected model, end-to-end.
- [`docs/cookbooks/deploy-agent-runtime-research.md`](../cookbooks/deploy-agent-runtime-research.md) — single-agent deploy path that uses (or opts out of) this layer.
- [`docs/cookbooks/deploy-multi-agent-startup-team.md`](../cookbooks/deploy-multi-agent-startup-team.md) — multi-agent path; HR's `protectedClassRefusal` and CFO's `notALicensedAdvisor` are policy metadata, not enforced by this layer.

The original v0.10.x sections above are preserved verbatim for historical context. Treat anything in §"What's NOT yet built" through the lens of this correction: items 1–3 are largely N/A; items 4–5 remain.

## Related

- `agent-base:privacy` — PII detection + redaction layer; wired into the 6 high-stakes bundles' `includes[]` (legal-counsel, tax, wealth-manager, auditor, recruiter, doctor). Low-stakes bundles intentionally opt out.
- RFC `docs/specs/rfc-tangle-pii-egress-controls.md` — platform-side gateway scanner + sandbox-runtime log filter (out of scope for this layer)
