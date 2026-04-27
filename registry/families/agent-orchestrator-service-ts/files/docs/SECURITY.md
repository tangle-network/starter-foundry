# Security

This document is honest about what the orchestrator does and does NOT
defend against. Read it before exposing this service on the public
internet.

## Threat model

The orchestrator stands between untrusted callers and an LLM provider
(`router.tangle.tools`). The threats we consider:

1. **Unauthorized callers** consuming LLM tokens on the operator's
   account. → Tenant API-key auth on every route except `/health`.
2. **One tenant exhausting capacity** for everyone else. → Per-tenant
   rate limiting (token bucket).
3. **Inbound webhook forgery** — attacker injecting fake events. →
   HMAC-SHA256 signature verification with a 5-minute replay window.
4. **Audit-trail tampering** — operator can't tell what happened. →
   Append-only NDJSON audit log with API-key fingerprinting.
5. **Egress sprawl** — random `fetch()` calls to LLM endpoints scattered
   through the codebase. → Single-egress invariant: only
   `src/lib/chat-bridge.ts` calls out.

## What this service does NOT defend against

Be explicit about the gaps. None of these are bugs — they're choices.
If your threat model includes them, harden before deploy.

### Tenant auth: API key in header

`X-API-Key: <key>` matched against the comma-separated `ORCHESTRATOR_API_KEYS`
env. **DO NOT use this in production without tightening.**

The known weaknesses:

- API keys are exact-match strings in env. No rotation grace period; you
  rotate by replacing the env value, which boots every existing key
  instantly.
- No per-key scopes — every key can hit every agent.
- No expiry, no revocation list, no per-request audit beyond fingerprint.

Upgrade paths:

- **JWT auth.** Replace the middleware in `src/index.ts` with a JWT
  verifier (issuer, audience, expiry, key rotation via JWKS). The
  fingerprint becomes `sub`, the rate-limit key becomes `sub` too.
- **mTLS.** Terminate TLS at a sidecar (Envoy, Caddy) that requires a
  client cert; pass the client identity to the orchestrator via header.
- **OAuth2 client-credentials.** If consumers are services, not humans,
  this is the standard.

### Single egress only holds if you maintain it

`src/lib/chat-bridge.ts` is the ONLY place outbound LLM traffic is
allowed. The compose-time validators do not enforce this — it's the
operator's job. Recommended:

```bash
# Pre-commit hook + CI lint
rg --type ts 'fetch\\(.+(openai|anthropic|router\\.)' src/ \\
  | rg -v src/lib/chat-bridge.ts \\
  && echo "egress sprawl" && exit 1
```

### Audit log: filesystem default

Default sink is `./.audit/orchestrator.ndjson`. This is fine for a
single instance and `tail -f`-style debugging. It is NOT enough for
production:

- Local disk loss = audit loss.
- Multi-instance deploy = N independent files, no global ordering.
- No tamper detection — anyone with FS write access can rewrite history.

For prod, swap the sink in `src/lib/audit.ts`. Targets:

- **S3** — append to a per-day key, with versioning enabled. Cheap,
  durable, queryable via Athena.
- **Postgres** — structured queries, easy retention policies.
- **Vendor** — Logflare, Axiom, Datadog Logs. Replace `appendFile` with
  a fetch to their ingest endpoint.

### HMAC webhooks: 5-minute window, no nonce table

`/webhooks/:event` verifies HMAC-SHA256 over `<timestamp>.<rawBody>` and
rejects timestamps more than 5 minutes from now.

The replay defense is **only** the timestamp window. There is no nonce
table; an attacker who captured a valid signed request can replay it
within 5 minutes. If the upstream service signs and the network is
public, an active MITM with TLS-strip access could replay.

If your threat model needs strict at-most-once delivery, add a
nonce-store: a TTL'd set keyed by `(sender, signature)`. Reject anything
seen before. Note this requires shared state across instances — use the
same store you'd use for global rate limiting.

### Rate limit: in-memory by default

`InMemoryRateLimitStore` lives in process memory. Multi-instance deploys
get **per-instance** limits, not per-tenant. A tenant who hits a load
balancer with N replicas effectively gets N× the configured rate.

Upgrade: see `src/lib/rate-limit.ts`'s comment block. Redis-backed
sliding-window is the standard fix.

### LLM input/output is NOT sanitized

The orchestrator passes user messages straight through to the LLM and
the LLM's reply straight back to the caller. We do NOT:

- Filter prompt-injection attempts from user input.
- Redact PII from outbound prompts or inbound replies.
- Rate-limit by token count (only by request count).

If your application processes sensitive data, layer guardrails BEFORE
this orchestrator (sanitize inbound) and AFTER (filter outbound) or
extend `chat-bridge.ts` with an in-flight policy hook.

## Operational checklist before exposing publicly

- [ ] Rotate `ORCHESTRATOR_API_KEYS` from the placeholder.
- [ ] Set a unique `WEBHOOK_HMAC_SECRET` per environment.
- [ ] Confirm `AGENT_PACK_DIR` is readonly to the service account.
- [ ] Decide on a real auth scheme (API key is a starter, not a finish line).
- [ ] Decide on a real audit sink (S3 / Postgres / vendor).
- [ ] Decide on a real rate-limit store (Redis / DO) if running >1 instance.
- [ ] Add a CI grep for `fetch()` outside `chat-bridge.ts`.
- [ ] Set up a monitor on `chat.reject` audit events — sustained spikes
      are usually misconfigured callers OR an attack.
