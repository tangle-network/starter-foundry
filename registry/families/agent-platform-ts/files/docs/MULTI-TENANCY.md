# Multi-tenancy model

## Where tenancy lives

| Concern | Component | File |
|---|---|---|
| Identification | `requireTenant()` middleware | `src/worker/lib/auth.ts` |
| Authorization scope | `c.var.tenant` is the only tenant source for routes | every `routes/*.ts` |
| Quota | `tenant.quota.requestsPerMinute` + `tokensPerDay` | `src/worker/lib/rate-limit.ts` |
| Per-tenant pack visibility | `tenant.packDir` (optional override) | `src/worker/routes/agents.ts` (extension point) |
| Audit attribution | every `audit()` call carries `tenantId` | `src/worker/lib/audit.ts` |

## Resolution flow

```
Authorization: Bearer <token>           ──┐
X-Platform-Api-Key: sk-plat-<tenant>-... ──┤── resolveTenant(c) ── 401 if absent
                                          │       │
                                          │       ├── { tenantId, auth, quota, packDir }
                                          │       │
                                          ▼       ▼
                                          c.set('tenant', ctx)
                                          c.var.tenant available downstream
```

Routes MUST read tenancy from `c.var.tenant`, never from a query string,
header, or untrusted body field. The compose-time validator flags any
route handler that doesn't call `c.get('tenant')` if it accesses
tenant-scoped data.

## Per-tenant pack dirs (optional)

The default behavior shows ALL registered packs to every tenant. To
isolate by tenant:

1. Issue session tokens with `packDir: '/agents/<tenantId>'`.
2. In `routes/agents.ts`, filter `listAgentPacks()` against the tenant's
   pack-dir — e.g., only include packs whose registry key starts with
   the tenant's prefix.
3. In `routes/chat.ts`, before calling `loadAgentPack(agentId)`, assert
   the tenant has read access:
   ```ts
   if (tenant.packDir && !agentId.startsWith(tenant.packDir)) {
     return c.json({ error: 'agent_not_found' }, 404)
   }
   ```

The platform deliberately doesn't ship this filter by default — the
right ACL model is product-specific. Consult your auth provider's
docs for how to embed `packDir` (or a richer ACL) in tenant tokens.

## Per-tenant secrets

Don't store per-tenant secrets in environment variables. Use:

- **D1**: per-tenant table with a column for each secret kind. Read on
  request, cache nothing in the worker.
- **KV**: `secrets:<tenantId>:<key>` with `expirationTtl` for rotation.
- **External Vault** (HashiCorp Vault, Doppler, AWS Secrets Manager) via
  Cloudflare Worker bindings or fetch.

Every secret read SHOULD audit-log so the operator can detect a tenant
exfiltrating its own credentials beyond expected access patterns.

## Per-tenant runtime isolation

The platform itself runs in a single Cloudflare Worker process. Two
tenants share that process. This is FINE for the gateway role — there is
no execution of tenant-supplied code in the worker.

If your agents execute tool calls (run code, file IO, shell commands):

- **Per-tenant Tangle sandbox**: spawn a `@tangle-network/sandbox-sdk`
  container scoped to the tenant. The sandbox enforces OS-level isolation
  (`noNewPrivileges`, `capDrop:ALL`, network-egress whitelist).
- **Per-request sandbox**: for short-lived tool execution, spawn a
  sandbox per chat invocation and tear it down. Higher overhead, stronger
  isolation, no cross-request state.

The choice is operator policy. The platform exposes the seam in
`chat-bridge.ts` — if the agent emits a tool-call response, the route
handler is the right place to dispatch it into a sandbox.

## Compliance flags

| Need | Where to wire it |
|---|---|
| GDPR right-to-erasure | KV-list `audit:*:*tenantId=<id>*` and delete; D1 `DELETE FROM audit WHERE tenant_id = ?` after forwarding |
| SOC 2 audit trail | Forward `env.AUDIT` to a durable sink (see `docs/SECURITY.md`) |
| HIPAA PHI segregation | Per-tenant pack dirs + per-tenant sandbox + BAA with Cloudflare |
| Per-tenant data residency | Set `placement.mode: smart` in `wrangler.jsonc` and pin tenant data to the matching D1 region |
