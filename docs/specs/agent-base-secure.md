# `agent-base:secure` — security floor for every agent-runtime bundle

> Status: spec, pre-impl
> Owner: starter-foundry
> Threat model: untrusted multi-tenant agent runtime; the layer's primitives are the trust boundary every bundle inherits

## Why this exists

Every agent — therapist, doctor, music producer, recruiter, vet — has the same infrastructure needs:
secrets, files, schedules, webhooks, identity, audit. Without a shared layer:
- Each bundle re-implements the same 7 primitives, often half-right
- Security audits scale O(N×primitives) instead of O(primitives)
- A vulnerability in one bundle's secret-handling fix isn't applied to the other 49

`agent-base:secure` is the trust boundary. Every primitive is secure by default — opt-out is explicit and logged.

## What MUST be secure (non-negotiable)

These are the seven primitives. Each ships as a small TS module under `src/lib/secure/`. Composes with `agent-base:tangle` and `agent-output:blocks`.

| # | Primitive | Surface | Security guarantee |
|---|---|---|---|
| 1 | **secrets** | `loadSecret(name)` / `requireSecret(name)` | Encrypted at rest via dotenvx (`.env.encrypted`). Decryption requires the deployer's private key (env: `DOTENV_PRIVATE_KEY`). Never logged. Memoized per-process; cleared on `secrets.purge()`. Read events go to audit log. |
| 2 | **workspace** | `workspace.read(path)` / `workspace.write(path, content)` / `workspace.list(prefix)` | All paths sandboxed under `/workspace/<agent-id>/`. Path-traversal rejected. `/workspace/<agent-id>/sensitive/` enforces additional ACL (read requires explicit capability). Disk quota enforced. Every write is audit-logged with content-hash. |
| 3 | **webhook-in** | `defineWebhook({ path, schema, handler })` → mounted at `/webhooks/<bundle>/<path>` | HMAC-SHA256 signed (`X-Tangle-Signature` header), 5-min replay window via signed timestamp, schema-validated body. Reject-loud on signature/timestamp/schema fail. Successful deliveries audit-logged with sender identity + payload hash. |
| 4 | **webhook-out** | `webhook.send(target, payload, { sign, retry })` | HMAC-signed by the agent's identity. Retries on 5xx with exponential backoff (max 3). Circuit breaker per target (open after 5 consecutive failures, 60s cooldown). Outbound URL whitelist enforced from `manifest.defaults.allowedDomains`. Every send audit-logged. |
| 5 | **schedule** | declared in `manifest.defaults.schedule.{ id, cron, capability, atLeastOnce? }` | Trigger executes with the agent's signed identity. At-least-once delivery option. Failures retried per backoff policy. Every fire audit-logged with trigger-id + capability + outcome. Replaces wrangler.toml `[triggers]`. |
| 6 | **identity** | `identity.current()` returns `{ agentId, sessionId, deployerId, signedAt, expiresAt }` | Every agent has an ephemeral signed identity (Ed25519). Cross-agent calls require valid signature + identity claim. TTL ≤ 1 hour, auto-rotated. Rotation event audit-logged. The agent CANNOT forge another agent's identity. |
| 7 | **audit** | `audit.log({ event, actor, target, payload? })` | Append-only log per agent, signed per-line. Stored under `/workspace/<agent-id>/.audit/` with daily rotation. Replay-resistant via per-line monotonic sequence. The agent CANNOT delete or rewrite past audit lines. Operator can export the chain for compliance review. |

## What MUST NOT be in scope (explicit non-guarantees)

The layer does not:
- Replace network-layer sandbox enforcement (sandbox-sdk's `noNewPrivileges` + `capDrop` + `allowedDomains` still enforce at the OS level — the layer is in-process logic)
- Implement encryption-in-transit (TLS terminates at the Tangle gateway; this layer assumes that holds)
- Provide cross-bundle PII redaction (each bundle is responsible for its own data minimization; layer provides storage zones, not classifiers)
- Resist malicious agent code (the agent's own code paths can `process.exit`, exhaust the disk quota, or burn LLM credits — those are operator policy concerns, not layer concerns)
- Provide multi-region replication or backup (storage layer is single-region; backup is an operator responsibility)

## Threat model

Adversaries the layer defends against:
1. **Malicious incoming webhook** — defended by HMAC + replay-window + schema validation. An attacker without the shared secret cannot inject events.
2. **Cross-agent data leak** — defended by workspace ACL. Agent B cannot read Agent A's `/workspace/A/`.
3. **Replay of legitimate webhook traffic** — defended by signed timestamp inside HMAC scope.
4. **Identity forgery / agent-impersonation** — defended by Ed25519 signed identity + per-call signature.
5. **Audit-log tampering** — defended by per-line signing + monotonic sequence; tampering is detectable.
6. **Secret exfiltration via logs** — defended by `loadSecret()` returning a `SecureString` that throws on `.toString()`/JSON serialization without explicit `unsafeReveal()` (which is itself audit-logged).

Adversaries the layer does NOT defend against:
- A compromised Tangle gateway (TLS + signing happens upstream of the agent runtime)
- A compromised host kernel (out of scope; sandbox-sdk handles host-level isolation)
- Side-channel attacks (timing, cache) — out of scope
- An operator who deliberately bypasses the layer (non-goal — the layer exists to make secure the easy default; operators with admin keys can do anything)

## Operator responsibilities (what the layer does NOT do for you)

When you deploy a bundle that includes `agent-base:secure`:
1. Provision a deployer Ed25519 keypair and store the private key in `DOTENV_PRIVATE_KEY` (the layer reads from env)
2. Encrypt your secrets via `dotenvx encrypt .env --key <pubkey>` before checkin — never check in plaintext
3. Choose your workspace storage backend (Tangle sandbox FS by default; opt-in to S3-compatible if you need durability)
4. Configure the gateway's TLS, allowedDomains, and quotas — the layer trusts the gateway
5. Periodically export `/workspace/<agent-id>/.audit/` to an off-host store for compliance

## What bundles look like after this lands

```
agent-runtime-<role>-ts/
  manifest.json
    {
      "id": "...",
      "includes": ["agent-base:tangle", "agent-base:secure", "agent-output:blocks", ...],
      "defaults": {
        "schedule": [{ "id": "morning-summary", "cron": "0 8 * * *", "capability": "morning-summary" }],
        "secrets":  ["MUSICBRAINZ_USER_AGENT", "PHONY_API_KEY"],
        "webhooks": {
          "in": [{ "path": "/pt-session", "schema": "schemas/pt-session.json", "capability": "ingest-pt-session" }]
        },
        "outboundDomains": ["api.tangle.tools", "musicbrainz.org"]
      }
    }
  files/
    AGENTS.md            ← role + how-you-think + tools-by-name (refers to the secure layer)
    TOOLS.md             ← TOC of *intent*: tools the operator might add (e.g. analyze-audio)
    methodology/         ← short tool-using guides
    README.md
    # NO wrangler.toml — opt-in only if deployer chooses CF Workers
    # NO tools/ scripts — operator materializes from TOOLS.md if/when needed
    # NO templates/ — replaced by methodology/
```

5-6 markdown files + manifest. Total bundle size: ~10-20 KB. Maintenance burden per bundle: minimal.

## Implementation plan

1. `registry/layers/agent-base/secure/manifest.json` declares the layer; appliesTo includes every agent-runtime bundle
2. `registry/layers/agent-base/secure/files/lib/secure/*.ts` — 7 small modules (~50-150 LOC each)
3. New validators in `src/lib/validate.ts`:
   - `agents-md-valid` (frontmatter check on AGENTS.md)
   - `methodology-index-valid` (replaces template-index-valid for new bundles)
   - `schedule-valid` (validates `manifest.defaults.schedule` cron syntax + capability resolution)
   - `secrets-declared-valid` (every secret listed in `manifest.defaults.secrets` must have a matching declaration in the layer's encrypted vault structure)
4. Update validator registry in `src/types/registry.ts` to recognize the new check types
5. Document via this spec + `agent-base:secure/README.md`
