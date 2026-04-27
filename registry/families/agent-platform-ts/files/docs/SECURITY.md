# SECURITY model — agent-platform-ts

This document is the operator-facing threat model. It cites the gaps from
`docs/specs/agent-base-secure.md` (the secure-base layer) and notes which
of those gaps the platform itself MUST close, vs which fall through to
Cloudflare's edge or to the underlying OS sandbox.

## What the platform IS

The platform is a multi-tenant gateway in front of agent runtimes:
- It terminates TLS at Cloudflare's edge.
- It owns tenant identity verification (we are the gateway — no upstream
  is going to do this for us).
- It is the single egress point to LLM providers (`router.tangle.tools`).
- It logs every meaningful action to an audit trail.

## What the platform is NOT

- It is **not** a sandbox. Agent code execution is the operator's concern;
  if your agents run untrusted tool calls, run them inside Tangle
  `sandbox-sdk` containers (one per tenant or per request), not in the
  worker process.
- It is **not** a key custodian. Per-tenant secrets, API keys to
  third-party services, and signing keys belong in your secrets manager
  (`wrangler secret put` for platform-wide secrets, KV/D1/Vault for
  per-tenant).
- It is **not** identity-verification-complete. `auth.ts` is a placeholder
  — you MUST replace it before production.

## Honest threat model

| Concern | What's enforced | Where the gap is |
|---|---|---|
| **Tenant isolation** | Auth-scoped at the app layer: `requireTenant()` middleware reads `Authorization: Bearer <token>` (or `X-Platform-Api-Key`) and stamps `c.var.tenant`. Routes MUST read tenant from `c.var.tenant` only. | Runtime isolation between tenants is the operator's job — spawn one `sandbox-sdk` container per tenant (or per request) when invoking tools that touch tenant data. The platform itself runs in a single worker process; a logic bug in a route is a tenant-isolation bug. |
| **Single egress** | `chat-bridge.ts` is the only file permitted to `fetch()` `router.tangle.tools` (or any LLM-shaped chat-completions URL). The bundle-check validator (registry-side) flags direct LLM fetches anywhere else. | The invariant only holds if operators keep it. If you `import { fetch }` from a custom util and call OpenAI directly, the platform's per-tenant cost tracking, prompt-injection-defense, and observability claims silently break. Code review is the boundary. |
| **Audit log** | Default sink is Cloudflare KV (`env.AUDIT`). Every significant action — chat invoke, auth reject, rate-limit trip, webhook accept/reject — emits an `AuditEntry` zod-validated envelope. | KV is **not** durable enough for compliance retention. Eventually-consistent reads, 90-day default TTL, 1MB/key + 30 writes/sec limits make it a *transit* sink, not a *system-of-record* sink. Production deploys MUST forward off-cluster (D1, R2, external SIEM, Splunk, Datadog). The audit entry shape is stable; swap the sink in `lib/audit.ts`. |
| **Identity verification** | The platform IS the gateway, so `agent-base:secure`'s NOT-YET-BUILT `identity.verify()` status doesn't apply to upstream verification. The platform itself MUST verify tenant auth tokens. | `auth.ts` is a placeholder — accepts any HMAC-signed token using `AUTH_SECRET`. Anyone with `AUTH_SECRET` can mint any tenant id. Replace with NextAuth/Better-Auth/Clerk/Supabase-Auth before going live. |
| **Rate-limiting** | KV-backed token bucket per tenant. `consumeRequest()` is called BEFORE expensive work (LLM call, pack load). | KV is eventually consistent across PoPs. Two concurrent requests in different regions can both pass at the same moment. For LLM-cost-bounded workloads the slop is fine; for monetary-metering it's not — swap `rate-limit.ts` to use Durable Objects (or external Redis with Cloudflare Queue) when atomicity matters. |
| **Webhook authentication** | HMAC-SHA256 + 5-min replay window + timing-safe compare + schema validation, all done before the handler runs. Pattern lifted from `agent-base:secure/webhook-in.ts`. | Per-nonce replay dedup within the 5-min window is NOT implemented — within a 5-minute burst, an attacker who captures a valid signature can replay it once. Add a `seen:<sig>` KV write with a 300s TTL when this matters. |
| **Single-egress vs `fetch()` direct** | `chat-bridge.ts` enforces the bottleneck for LLM calls only. | Tools that need to hit other services (Slack, GitHub, internal APIs) bypass `chat-bridge.ts` and call `fetch()` directly. The Cloudflare worker has unlimited egress by default; a malicious or buggy tool can exfiltrate tenant data. Pair with `webhook-out`-style egress whitelisting if the threat is real. |
| **Body-size DoS** | Hono's default — caller can send up to whatever Cloudflare's request-body limit is (~100MB on paid plans). The chat zod schema caps `message` at 32K chars, but a malicious attacker can send a 32K message in a tight loop until rate-limit kicks in. | Rate-limit IS the defense. Tune `requestsPerMinute` per tenant tier. |
| **Prompt injection** | Out of scope at this layer. Pack-author concern: write defensive system prompts. | The platform never strips, escapes, or filters user messages — that's the agent's job. |

## Audit-log lifecycle (operator MUST configure)

KV-default audit is a *starter*, not a destination. Every production
deploy MUST configure forward-off-cluster:

1. **D1**: `wrangler d1 create audit_log` + insert from a Workers cron
   trigger that drains the KV namespace nightly. Durable, queryable.
2. **R2**: nightly export to `audit/YYYY-MM-DD.jsonl` + lifecycle policy
   for retention. Cheap, opaque to query.
3. **External SIEM**: Workers cron POSTs to Splunk HEC / Datadog Logs /
   Honeycomb. Best for incident response; costs scale.

Pick one; document the choice in your runbook.

## Operator responsibilities

When you deploy this platform:

1. **Replace `auth.ts`**. The placeholder is dev-only.
2. **Configure a durable audit sink**. KV is transit, not retention.
3. **Set per-tenant rate-limits** in your auth provider — defaults are
   30 req/min, 200K tokens/day. Tune to your business model.
4. **Lock down `wrangler.jsonc` `vars`** — `AGENT_PACK_DIR` is public
   (it's a string), but `TANGLE_ROUTER_KEY` / `AUTH_SECRET` MUST be
   `wrangler secret put`, not `vars`.
5. **Audit `chat-bridge.ts` is the only LLM egress**. Code review on every
   PR that adds a `fetch()` call to a chat-completions URL.
6. **Forward audit off-cluster** before any compliance window opens.
7. **Spawn per-tenant sandboxes** if your agents run code or make tool
   calls — the platform doesn't isolate tool runtime.

## Cross-references

- `docs/specs/agent-base-secure.md` — secure-base primitives this layer
  builds on (HMAC verify, audit chain, secrets façade, identity envelope)
- `docs/MULTI-TENANCY.md` — how the platform isolates tenants
- `docs/DEPLOYMENT.md` — operator-facing setup runbook
