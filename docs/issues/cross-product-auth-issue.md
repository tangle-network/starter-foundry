# Cross-product `sk-tan-*` auth scope: a single key cannot address two products on the same account

## TL;DR

- A `sk-tan-*` key minted with `product: "router"` returns 403 `Key scoped to router, not sandbox` at sandbox-api (`agent-dev-container/products/sandbox/api/src/middleware/auth.ts:331`). The platform stores `product` as a single nullable scalar (`agent-dev-container/products/platform/api/src/lib/schema.ts:106`), and the user-facing dashboard forces a single radio-button choice (`agent-dev-container/products/platform/web/src/client/pages/CreateKey.tsx:310-322`). Users with multiple products can only address them by minting N separate keys, which contradicts the dashboard tagline "One account across all Tangle products" (`Login.tsx:275`).
- starter-foundry's `scripts/deploy-agent-bundle.ts` is blocked at the live-deploy step on PR #94 — the only `TANGLE_ROUTER_USER_KEY` we have on the operator account (`~/company/devops/secrets/agent-state.env`) authenticates fine at router (`router.tangle.tools` does not enforce product, `tangle-router/lib/api-auth.ts:40-54`) but is rejected at `staging-sandbox.tangle.tools`. There is no UX to retroactively widen scope.
- **Recommended fix:** make `product` an optional **array** on the API-keys schema (`text("products", { mode: "json" }).$type<Product[]>()`), default unset to "all products" (already the storage convention — `null = all products`), and update the consumer enforcement check from `result.product !== "sandbox"` to `result.products && !result.products.includes("sandbox")`. Provide a one-click "scope to all products on my account" toggle in `CreateKey.tsx`. Migrate existing rows with `UPDATE api_keys SET products = json_array(product) WHERE product IS NOT NULL`. Quick-fix today: mint a fresh **unscoped** key (`tcloud keys create --name sf-deploy` with no `--product`, or pick "All products" in the dashboard) and use it for both router and sandbox-api.

## Reproduction

1. On `id.tangle.tools`, navigate to **Create API Key**, set Product Scope = **Router (inference)**, submit.
2. Capture the raw key (shown once).
3. Call sandbox-api:
   ```sh
   curl -i -X POST https://staging-sandbox.tangle.tools/v1/sandboxes \
        -H "Authorization: Bearer sk-tan-0An..." \
        -H "Content-Type: application/json" \
        -d '{"name":"deploy-test","image":"node:20"}'
   ```
4. Observe:
   ```
   HTTP/1.1 403 Forbidden
   { "error": "forbidden", "message": "Key scoped to router, not sandbox" }
   ```

Code path: `products/sandbox/api/src/middleware/auth.ts:327-339` — sandbox-api looks up the token via `PlatformClient.verifyKey()` (`products/sandbox/api/src/lib/platform-client.ts:223-271`) which forwards to `id.tangle.tools` `POST /v1/keys/verify` (`products/platform/api/src/routes/keys.ts:428-468`). The platform returns the stored scalar `product` field unchanged. sandbox-api then enforces `result.product !== "sandbox"`. router never invokes this check (`tangle-router/lib/api-auth.ts:40-54`).

## Expected vs actual

| | Expected | Actual |
|---|---|---|
| User mental model | "I have one Tangle account, one wallet, one credit pool — one key works at every product I have access to (modulo billing limits)." Reinforced by `Login.tsx:275` "One account across all Tangle products. $5 free credit on signup." | One key works at exactly one product, chosen at creation. Switching products requires minting a new key. |
| Dashboard UX | "All products" being the default produces a key that works everywhere on this account. | The "All products" option **does** exist (`CreateKey.tsx:317`) and produces a `product = NULL` row that bypasses the consumer check. **Most users don't realise this** — the option reads "Restrict this key to a specific product, or leave blank for full access" (`CreateKey.tsx:328-331`), but every operator-facing example, every starter-template `.env.example`, and every `tcloud auth login` flow demonstrates the product-scoped form. The unscoped form is undiscoverable from any starter path. |
| Migration | Re-scoping an existing key. | Not supported. `PATCH /v1/keys/:id` (`products/platform/api/src/routes/keys.ts:312-350`) only updates name/budgets/limits/expiry — `product` is immutable post-creation. The only path is **rotate** (`POST /:id/rotate`, line 376), which preserves product (`keys.ts:404`). |

## Root cause

The data model treats `product` as a single closed-set tag, and only one consumer (sandbox-api) enforces it.

```
                                    ┌────────────────────────────────────┐
                                    │  id.tangle.tools (platform/api)    │
                                    │  api_keys.product TEXT (nullable)  │
                                    │  schema.ts:106                     │
                                    └─────────────┬──────────────────────┘
                                                  │
   sk-tan-0An...                                  │ POST /v1/keys/verify
   (product=router)                               │ → returns { product: "router" }
       │                                          │
       ├──► router.tangle.tools                   │
       │    api-auth.ts:40-54                     │
       │    ✓ verifies, ignores `product`         │
       │    → 200 OK                              │
       │                                          │
       └──► staging-sandbox.tangle.tools          │
            auth.ts:327-339                       │
            checks result.product !== "sandbox"   │
            → 403 forbidden                       │
```

Five concrete files anchor the boundary, in dependency order:

1. **Schema** (`products/platform/api/src/lib/schema.ts:106`)
   ```ts
   product: text("product"), // null = all products, "router" | "sandbox" | "blueprint-agent" | "evals" | "agent-builder"
   ```
   Single TEXT column. The `null = all products` semantic exists in storage but is invisible in every UX and starter doc.

2. **Issuance enum** (`products/platform/api/src/routes/keys.ts:39-48` and `493-501`)
   ```ts
   product: z.enum([
     "router", "sandbox", "blueprint-agent",
     "evals", "agent-builder", "audits",
   ]).optional(),
   ```
   Both `POST /v1/keys` (user-facing) and `POST /v1/keys/provision` (S2S) enforce single-value. Optional means "null = all", but no caller path makes that easy to discover.

3. **Verifier projection** (`products/platform/api/src/lib/keys.ts:355-367`)
   ```ts
   return {
     valid: true,
     ...
     product: key.product ?? undefined,   // single string or undefined
   };
   ```

4. **Consumer enforcement** (`products/sandbox/api/src/middleware/auth.ts:331-339`)
   ```ts
   if (result.product && result.product !== "sandbox") {
     return c.json({
       error: "forbidden",
       message: `Key scoped to ${result.product}, not sandbox`,
     }, 403);
   }
   ```
   This is the only product check across all consumers. router (`tangle-router/lib/api-auth.ts`) does not enforce. blueprint-agent migration is in flight (issue #911) but not yet enforcing.

5. **Sandbox UX** (`products/platform/web/src/client/pages/CreateKey.tsx:310-322`)
   `<select>` with options router/sandbox/evals/blueprint-agent (no `audits`, no `agent-builder` — UI/API drift), no multi-select, no "all products on my account" affordance distinct from "all products that exist."

The auto-provisioning path (`PlatformClient.ensureRouterKey()` in `products/sandbox/api/src/lib/platform-client.ts:442-504`) sidesteps the issue by minting a **fresh** product=router key for the user every time sandbox-api needs to call router on their behalf — i.e. the platform internally accepts that "user wants to call N products" must mean "N keys exist," and sandbox-api orchestrates that for the in-sandbox case. This is the forward-the-key pattern noted in `~/.claude/projects/-Users-drew-webb-starter-foundry/memory/forward-the-key-pattern.md`. It does not help any external caller (CLI, deploy script, partner integration) that authenticated upstream by a single key.

## Surface area / blast radius

Every consumer of `sk-tan-*` keys, ranked by enforcement strictness:

| Consumer | Code path | Enforces `product`? | Failure mode for mismatched key |
|---|---|---|---|
| `staging-sandbox.tangle.tools` / sandbox-api | `products/sandbox/api/src/middleware/auth.ts:331` | **Yes**, hard 403 | "Key scoped to X, not sandbox" |
| `router.tangle.tools` | `tangle-router/lib/api-auth.ts:40-54` | No | Accepts any valid `sk-tan-*` |
| starter-foundry deploy script | `scripts/deploy-agent-bundle.ts` (PR #94) | Inherits sandbox-api (calls it) | 403 cascades from sandbox-api |
| blueprint-agent | `agent-dev-container/products/platform/api/src/routes/keys.ts:432` lists `blueprint-agent` as an allowed S2S verifier; migration in flight per issue #911 | Not yet (migration prereqs in #911) | TBD; the platform's verify endpoint already supports `blueprint-agent` scope |
| evals | platform allow-lists `evals` as a verifier service (keys.ts:438) | Unknown — code lives outside agent-dev-container; no verifier file in this repo | TBD |
| agent-builder | platform allow-lists `agent-builder` (keys.ts:439); see issue #913 | Likely no (the SDK gaps issue describes scoped-token pain that suggests scope is currently full-bearer) | TBD |
| audits.tangle.tools | platform allow-lists `audits` (keys.ts:440); registered in commit `030c1f0b4` | TBD | TBD |
| browser-agent | platform allow-lists `browser-agent` (keys.ts:434) | Unknown | TBD |
| admin-cli | platform allow-lists `admin-cli` (keys.ts:441) | N/A — internal | N/A |

The enum drift across UI / Zod / docs is itself a problem: `audits` is in the API schema (`routes/keys.ts:46`) but not in the UI dropdown (`CreateKey.tsx:317-322`), and `agent-builder` is in the API but the UI omits it.

`provision` (S2S) is allow-listed to **`sandbox` only** today (`products/platform/api/src/routes/keys.ts:519`) — so if a downstream product (blueprint-agent, agent-builder) wants to mint a downstream key on a user's behalf the way sandbox-api does for router, that S2S path doesn't exist for them. Issue #913 calls this out as a "consumer-side scoped token primitive" gap.

Billing implication of the current model (`schema.ts:191`):
```ts
product: text("product"), // "router" | "sandbox" | ... | null
```
on `creditTransactions` — every charge is tagged with the product that fired it. The credit pool itself is shared (`creditBalances` is per-user, no product split, line 173-179). A multi-product key does **not** create double-billing risk — billing is cleanly scoped to the consumer that called `platform.deduct()`. This is critical: there is no billing reason to keep `product` as a single scalar on `api_keys`.

## Ranked fixes

### Option A — `products: string[]` (multi-product key) ⭐ recommended

Replace the scalar `product TEXT` with `products TEXT (JSON array)`. Default unset means "all products on this user/team's account" (preserving today's `null` semantic). The dashboard becomes a multi-select with a "Select all" toggle.

**Implementation effort: M (1-2 weeks).** Schema migration + backfill + verify-projection update + UI rework + every consumer's enforcement clause flips to `Array.includes()`.

**Pros**
- Matches the dashboard's stated mental model ("One account across all Tangle products") without giving every key full account-bridging power by default.
- No billing change — the `product` column on `creditTransactions` continues to be the consumer's deduct-time tag, decoupled from key scope.
- Backwards-compatible read path: `null products` and `[]` both = "all products," matching today's `product = NULL`.
- Generalises cleanly to issue #911 (blueprint-agent identity migration) and issue #913 (consumer-side scoped tokens) without painting a corner.
- Migration is mechanical: `UPDATE api_keys SET products_json = json_array(product) WHERE product IS NOT NULL`. Existing single-scope keys keep working.

**Cons**
- Touches every consumer's enforcement clause (today: just sandbox-api). Each one needs an updated check.
- Schema migration on a live Turso DB requires a `db:push` window.
- Doesn't solve the broader "scope is too coarse" problem — a key that can call sandbox + router still has full sandbox capability (cf. issue #913 Gap 1 wanting session-scoped read-only).

**Migration cost:** zero user-visible breakage. Single-scope keys keep matching their single product after backfill.

**Billing implications:** none.

**Long-term answer or band-aid:** correct long-term. Pairs with Option D (OAuth scopes) as a future hardening but is the right next step today.

### Option B — Account-bound scope (drop the product field semantically)

Make `product` informational only. Every key works on every product the owning user/team has access to (gated by subscription tier, not key scope). Keep the column for analytics / per-key budget partitioning.

**Implementation effort: S (3-5 days).** Two-line patch at `auth.ts:331` (delete the check) + UI cleanup. No migration.

**Pros**
- Minimum code change.
- Matches what most users probably want and the dashboard tagline already promises.

**Cons**
- **Removes a security primitive in flight.** A leaked key with `product = "router"` today cannot be used to spin up sandboxes (which is meaningful — sandbox compute is more expensive than inference). Removing the check upgrades blast radius.
- Doesn't help builder-of-builders cases where a developer wants to mint a sandbox-only sub-key for a customer (issue #913 Gap 1).
- Makes the per-product budget feature worthless — if the key works everywhere, the `product`-tagged budget can't restrict spend.
- Goes against the direction of issue #729 (unified billing/identity ⇒ tighter, not looser, per-key scoping).

**Migration cost:** zero.

**Billing implications:** per-product key budgets become advisory-only.

**Long-term answer or band-aid:** band-aid. Cheap but degrades a working invariant.

### Option C — Better UX for the existing per-product-key model

Keep the scalar field. Add: (1) a "Mint sibling keys for {sandbox, router, blueprint-agent}" button that creates N keys in one click, all with the same name prefix; (2) a key picker in the dashboard side-panel that auto-fills the right key for the product the user is viewing; (3) make "All products" the default in `CreateKey.tsx`.

**Implementation effort: M (1 week).** Pure UI work plus a small `POST /v1/keys/batch` route.

**Pros**
- No data-model churn.
- Onboards the user to per-product scoping as a security feature (sub-key per blast domain), aligning with issue #913's developer DX.

**Cons**
- Users now hold N keys per integration. Every config file, env var, and CI secret slot multiplies. The authentication friction the operator just hit becomes the steady-state friction for everyone.
- Doesn't unblock starter-foundry's deploy script — it still needs to either ask "which product?" or hold both.
- The "default to All products" sub-fix is the only piece that meaningfully helps a new user; it can be done without the rest.

**Migration cost:** zero.

**Billing implications:** none.

**Long-term answer or band-aid:** band-aid that also encourages permanent fragmentation. The "default to All products" sub-fix is a strict improvement and worth shipping as a quick win regardless of which option wins.

### Option D — OAuth scopes / token exchange (proper auth model)

Replace long-lived `sk-tan-*` keys (for API contexts) with short-lived tokens minted via a `/v1/token` exchange. The user's `sk-tan-*` becomes a refresh-token analogue; access tokens carry per-product, per-resource scopes (`sandbox:write`, `router:inference`, `blueprint:read`) and expire in minutes. The platform already has a `ProductTokenIssuer` (`agent-dev-container/products/sandbox/sdk/src/auth/index.ts:57`) for the in-sandbox case — extend it cross-product.

**Implementation effort: XL (1-2 months).** New token-exchange endpoint, JWT signing infra (already partially present for `ProductTokenIssuer`), every consumer migrates from "verify raw key" to "verify JWT signature + scopes," CLI / dashboard / starter docs all change.

**Pros**
- Solves the scope problem at the level it actually exists. Multi-product is an OR of scopes; sandbox-read-only-for-this-session is a scope; revoking a session is JWT not-before; etc.
- Closes the F3 gap noted in `auth.ts:264` (orchestrator key holder is fully trusted because the platform exposes `/v1/keys/verify` by raw token only).
- Pairs with issue #913 Gap 1 (consumer-side scoped token primitive) — that's a subset of this.

**Cons**
- Multi-month migration. Every consumer changes. Every starter-template `.env` changes. Every customer that's hard-coded `sk-tan-*` rotates.
- Kills the "drop one secret in a `.env`" UX that's currently the main onboarding affordance.

**Migration cost:** every existing integration. Likely 6-12 month dual-stack.

**Billing implications:** unchanged at the deduct call site; potentially cleaner audit trail because each access token carries its own ID.

**Long-term answer or band-aid:** correct long-term, wrong-cost-right-now. Build Option A first; OAuth is the next-but-one step. Tracked already as issue #913.

### Option E — Status-quo + better error messages (band-aid only)

Replace `Key scoped to router, not sandbox` with `Key scoped to router, not sandbox. Mint a sandbox-scoped key at id.tangle.tools/keys/new?product=sandbox, or use an unscoped key for cross-product access.`

**Implementation effort: XS (one PR, four lines).**

**Pros**
- Trivial. Stops the "what does this error mean" loop.

**Cons**
- Doesn't fix the underlying friction. The user still rage-mints a second key; the operator's `.env` still grows.

**Long-term answer or band-aid:** band-aid. Worth shipping inside any other fix as a strict improvement to the error string.

## Recommendation

Ship **Option A (`products: string[]`)** as the next platform-side change, in parallel with Option E's error-message improvement.

Migration plan:

1. **Schema** — add `products TEXT (JSON array)` column to `api_keys`. Backfill `products = json_array(product)` for non-null rows. Keep the legacy `product` column writable for one release cycle, reading the new column first. (`products/platform/api/src/lib/schema.ts:106`)
2. **Verify projection** — return both `product` (string-or-undefined, deprecated) and `products` (string[] or undefined). Consumers updated in the same PR. (`products/platform/api/src/lib/keys.ts:355-367` and `products/platform/api/src/routes/keys.ts:444-467`)
3. **Issuance** — `POST /v1/keys` and `POST /v1/keys/provision` accept `products: z.array(z.enum([...])).optional()`. The legacy `product` field aliases to `products: [product]` and emits a `Sunset` header. (`products/platform/api/src/routes/keys.ts:39-48, 493-501`)
4. **Consumers** — sandbox-api `auth.ts:331` becomes `if (result.products && !result.products.includes("sandbox"))`. Same patch lands in blueprint-agent (issue #911 prereq), audits, agent-builder. router stays no-op.
5. **UX** — `CreateKey.tsx` becomes a multi-select with default = "All products on my account" (the `null` / `[]` semantic, surfaced for the first time). Show the actual product chips per key in `Keys.tsx`.
6. **Docs + memory** — kill `~/.claude/projects/-Users-drew-webb-starter-foundry/memory/gap-sk-tan-scope.md` since the gap is closed; update starter-foundry `.env.example` to recommend an unscoped key.

## Open questions

1. **Per-product key budget semantics under multi-scope.** Today a `product = sandbox`, `budgetUsd = 50` key implies "this key can spend $50 on sandbox." Under Option A, a `products = ["sandbox", "router"]`, `budgetUsd = 50` key — does the $50 pool burn down across both products together, or is there a per-product split? Recommendation: pool. But confirm with billing. (Code: `products/platform/api/src/lib/keys.ts:329-342` checks budget at verify; `creditTransactions` (`schema.ts:191`) tags by product but `apiKeys.budgetUsd` is a single column.)
2. **What enforces `product` at non-sandbox consumers today?** I confirmed router does not. blueprint-agent, audits, agent-builder, evals, browser-agent, are all listed as allowed verifier services on the platform (`routes/keys.ts:432-441`) but their consumer code is in separate repos that I did not exhaustively read. Worth a 30-minute audit to confirm before changing the enforcement contract.
3. **How does the orchestrator's delegated identity path interact with multi-product?** The X-Platform-User-Id flow (`auth.ts:226-298`) skips the product check entirely (the orchestrator is fully trusted). With multi-scope, that's still correct — but worth making explicit in the trust-boundary doc.
4. **Is `null = all products` literally documented anywhere user-facing?** Grepping shows it only in the schema comment (`schema.ts:106`). Almost certainly the discoverability problem on the existing primitive is half the bug.
5. **Does the F3 revocation-visibility gap (auth.ts:274) get worse under Option A?** Current model: an orchestrator-key holder can claim any user_id and any product implicitly. Under Option A, same surface. Probably no change, but tag for the auth team.

## Related

- **Issue #729** ([TASK] Unified billing/identity solution for all top level products) — the umbrella; this issue is one prerequisite to closing it.
- **Issue #911** ([CHECKLIST] Platform prereqs for Blueprint Agent identity migration) — explicitly notes "`api_keys.product` is plain TEXT" and treats single-scope as immutable. Option A is the way to make blueprint-agent's enforcement clause future-proof.
- **Issue #913** (SDK gaps for builder-of-builders apps) — Gap 1 (consumer-side scoped token primitive) and Gap 4 (token refresh) overlap heavily with Option D. Option A is the fast path; Option D / #913 is the right long-term story.
- **Memory note** `gap-sk-tan-scope.md` — original framing of this bug.
- **Memory note** `forward-the-key-pattern.md` — `X-Tangle-Forwarded-Authorization`. Relevant because it's how sandbox-api today bridges sandbox-scope→router-scope by minting a NEW router-scope key (`PlatformClient.ensureRouterKey()`, `products/sandbox/api/src/lib/platform-client.ts:442-504`). Option A makes this auto-provisioning path optional rather than load-bearing for the in-sandbox case.
- **Memory note** `billing-architecture-one-meter.md` — confirms billing pool is unified per-user; Option A doesn't disturb that invariant.
- **Closed issue #703** ([BUG] public sandbox create hides LiteLLM scoped key generation) — related historic friction in the same area; the resolution there expanded UX visibility, which is the same lever Option A pulls on the multi-scope problem.

## Quick-fix for starter-foundry's blocker (today)

The `TANGLE_ROUTER_USER_KEY` we have was minted with `product = router`. The remediation is **mint a fresh unscoped key** and use it for both router and sandbox-api:

```sh
# Option 1: dashboard
# Visit https://id.tangle.tools/app/keys/new
# Set Name = "starter-foundry deploy", leave Product Scope = "All products"
# Copy the key once, store as TANGLE_ROUTER_USER_KEY in agent-state secrets.

# Option 2: tcloud CLI (if logged in)
tcloud keys create --name "starter-foundry deploy"
# (no --product flag = unscoped, works at every consumer)

# Option 3: raw API (requires existing session bearer)
curl -X POST https://id.tangle.tools/v1/keys \
     -H "Authorization: Bearer $EXISTING_SESSION_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"starter-foundry deploy"}'
   # NB: omit "product" entirely. The Zod schema makes it optional (routes/keys.ts:39-48).
```

Then update `~/company/devops/secrets/agent-state.env`:

```
TANGLE_ROUTER_USER_KEY="encrypted:<new unscoped key>"
```

Re-run `pnpm deploy-agent --bundle ... --api-key-env TANGLE_ROUTER_USER_KEY ...`. The same key now passes both `staging-sandbox.tangle.tools` and `router.tangle.tools` because (a) sandbox-api's check at `auth.ts:331` short-circuits on `result.product` being falsy, and (b) router never checks `product` at all (`tangle-router/lib/api-auth.ts:40-54`).

This is the literal minimum unblock and does not require any code change. The issue stays open because it's the wrong default and the wrong UX, not because there's no workaround.
