# Multi-Agent End-to-End Validation — Dogfood Report

**Date**: 2026-04-26
**Worktree**: `.claude/worktrees/agent-ae518e36d229da85f`
**Branch**: `docs/dogfood-multi-agent-validation`
**Goal**: Prove the multi-agent format actually works end-to-end against `router.tangle.tools`. Outcomes: PROOF, GAP, or REGRESSION.

---

## TL;DR

**Three findings, ranked.**

1. **GAP (multi-agent)** — `agent-platform-ts` cannot load any `multi-agent-*-ts` template. The platform expects a single-agent pack shape (`system-prompt.md` body + `methodology/index.json` matching `{version: 1, guides[]}`). Multi-agent templates ship `agent-roster.json` + `coordination-protocol.md` + `roles/<id>/system-prompt.md`. Schema validation fails at `loadAgentPack`. The platform's `chat.ts` route also has no concept of role routing, `:::handoff` blocks, or default-respondent selection — even if the loader were extended, the chat handler would still produce a single concatenated system prompt with no team coordination.
2. **GAP (every single-agent runtime template)** — every `agent-runtime-*-ts/files/methodology/index.json` ships shape `{entries: [{id, capability, path, tags, version}]}` while the platform's zod schema is `{version: 1, guides: [{slug, title, summary, path}]}`. **Zero registry packs are drop-in compatible.** An operator must hand-translate the index for every pack they wire.
3. **GAP (composed `package.json`)** — composed apps declare `@tangle-network/sandbox-sdk@^0.5.0`, `@tangle-network/sandbox-ui@^0.10.3`, `@tangle-network/tcloud@^0.4.0` but none are published to npmjs.org and the composed app ships no `.npmrc` pointing at a private registry. `pnpm install` 404s out of the box. The deps are unreferenced in code (only in comments) — they're aspirational declarations.

**PROOF (single-agent path, after manual repairs)** — once the three gaps are worked around manually, the platform's `/api/chat/:agent` against `router.tangle.tools` works:

- HTTP 200 in **4568 ms** end-to-end (cold first request), real LLM response.
- `usage`: `{prompt_tokens: 1146, completion_tokens: 270, total_tokens: 1416}`.
- Real recruiter system prompt drove a real answer about interview-loop priorities.

**Bottom line**: the platform compiles and the LLM egress works, but the team-coordination story is not implemented in the worker — it is an *unwired* protocol document. The README claims the runtime "reads `agent-roster.json` to enumerate roles" and "handoffs route to the named peer". That code does not exist in `agent-platform-ts/files/src/worker/`.

---

## What was tested

**Compose**:
```ts
import { composeStarter } from '/Users/drew/webb/starter-foundry/dist/lib/compose.js'
await composeStarter({
  spec: { projectName: 'dogfood', family: 'agent-platform-ts', layers: [], slots: {}, variables: {} },
  outDir: '/tmp/dogfood-platform'
})
```

Result: 40 files written, including `src/worker/index.ts`, `src/worker/lib/load-agent-pack.ts`, `src/worker/routes/chat.ts`, `src/worker/lib/chat-bridge.ts`, `wrangler.jsonc`, `package.json`. Compose exit code 0.

**Install** (after stripping unpublished `@tangle-network/*` deps):
- Clean install in 2.9s, no errors.
- 3 ignored build scripts (esbuild, sharp, workerd — expected).

**Local server**: `wrangler dev --port 8787 --local` — bound `AUDIT`, `RATE_LIMIT`, `ASSETS`, `TANGLE_ROUTER_KEY`, `AUTH_SECRET`. `Ready on http://localhost:8787` in ~6s.

**Health probe**:
```
GET /api/health → {"status":"ok","packCount":1,"routerReachable":true}
```

**Chat probe** (after registering an inlined recruiter pack):
```
POST /api/chat/recruiter
Authorization: Bearer <hmac-signed-token>
Body: {"message":"We are hiring our first engineer. What should I prioritize in the interview loop?","history":[]}

→ HTTP 200 in 4568 ms
→ Body (first 500 chars):
"To design an effective interview loop for your first engineering hire, it's
essential to focus on the bona-fide qualifications that align with your
organization's needs. Here are some key areas to prioritize:

1. **Technical Skills**: Assess the candidate's proficiency in the
   programming languages, frameworks, and tools relevant to your projects.
   This could include coding challenges or technical questions.

2. **Problem-Solving Ability**: Evaluate how the candidate approaches
   complex problems..."
→ Roster role: n/a — single-agent pack, no multi-role routing
```

---

## GAP 1 — Multi-agent format mismatch

### Where

`registry/families/agent-platform-ts/files/src/worker/lib/load-agent-pack.ts:28-42, 132-147`

### Platform expects (zod schema)

```ts
const MethodologyIndex = z.object({
  version: z.literal(1),
  guides: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    summary: z.string(),
    path: z.string(),
  })),
})

interface AgentPack {
  id: string
  name: string
  description: string
  tags: string[]
  model: string
  systemPrompt: string         // single string at pack root
  methodology: MethodologyIndex
}
```

### Multi-agent ships

`registry/families/multi-agent-startup-team-ts/files/`:

- `agent-roster.json` — 5 roles, default respondent, handoff/escalation block markers, joint-decision cadence
- `coordination-protocol.md` — routing table, `:::handoff` format, escalation triggers
- `roles/{ceo,cto,cmo,hr,cfo-advisor}/system-prompt.md` — 5 role-specific prompts
- `roles/<id>/methodology/<slug>.md` — methodology files (no `index.json` per role)

### Programmatic confirmation

```
MethodologyIndex.parse(agent-roster.json) → FAIL
  - version : Invalid literal value, expected 1
  - guides : Required

ceo methodology files: [ 'decision-journal.md', 'okr-design.md', 'weekly-review.md' ]
ceo has index.json? false
```

### What's missing in the platform code

`chat.ts` has no concept of:
- Role selection (line 76-80: builds a single `messages[]` with one `pack.systemPrompt`)
- `:::handoff` block parsing (parse-blocks.ts handles `:::artifact` etc., but no handoff-driven re-dispatch)
- Default-respondent + routing-table dispatch
- Multi-role joint-decision turns

A faithful multi-agent runtime needs at minimum:
1. A roster loader that reads `agent-roster.json` and registers each role as its own pack-like entry.
2. Coordination-protocol injection — `coordination-protocol.md` becomes a *prefix* on every role's system prompt.
3. A first-turn dispatcher that picks the role from the request (explicit role tag, or default respondent).
4. Handoff handling — when a response contains `:::handoff to: <id>`, the runtime spawns a follow-up turn against the named role and threads the conversation.
5. Joint-decision turns — when an artifact requires multiple roles, fan out and assemble.

None of (1)-(5) exist in `agent-platform-ts/files/src/worker/`. **The multi-agent capability is documented but unwired.** This is the shipped-but-unwired pattern from `~/.claude/projects/.../shipped-but-unwired-pattern.md`.

### Recommended fix

Smallest workable change (~150-250 LOC):
- New file `src/worker/lib/load-agent-roster.ts` — reads `agent-roster.json` + `coordination-protocol.md` + every `roles/<id>/system-prompt.md`. Registers each role under id `<team>:<role-id>` (e.g. `startup-team:ceo`).
- Extend `chat.ts` to detect `:agent` containing `:` → dispatch to roster mode, accept optional `{role}` field on body, default to roster.defaultRespondent.
- Add `parseHandoff` to `parse-blocks.ts`. When response carries a `:::handoff` block, return it in the `blocks[]` array — the *client* can re-POST with the handoff target as the next role. (Server-side auto-rerouting is a v2 concern.)
- Update `MethodologyIndex` to be a discriminated union — accept either the current `{version, guides}` or the multi-agent `agent-roster.json` shape.

A v2 add: server-side handoff loop, capped at N hops per request.

---

## GAP 2 — Single-agent runtime templates also incompatible

Even ignoring multi-agent, **none** of the `agent-runtime-*-ts` packs in the registry drop into the platform without translation.

Sample `agent-runtime-recruiter-ts/files/methodology/index.json`:
```json
{
  "entries": [
    { "id": "jd-drafting-protocol", "capability": "jd-drafting", "path": "./jd-drafting-protocol.md", "tags": [...], "version": "0.1.0" },
    ...
  ]
}
```

Platform's zod requires `{version: 1, guides: [{slug, title, summary, path}]}`. Field-by-field: `entries → guides`, `id → slug`, `capability → ` (no equivalent), `+ title (missing in templates)`, `+ summary (missing)`, `version: "0.1.0" → 1` (literal int).

Verified across `agent-runtime-recruiter-ts`, `agent-runtime-doctor-ts`, `agent-runtime-architect-ts`, `agent-runtime-product-manager-ts` — all use `{entries: [...]}` shape.

### Recommended fix

Pick one source of truth and align the registry. Either:
- (a) Update the platform's `MethodologyIndex` to accept `{entries: [{id, capability, path}]}` and synthesize `slug/title/summary` from it.
- (b) Update every `agent-runtime-*-ts/files/methodology/index.json` to the platform shape.

(a) is one-touch; (b) is N-touch but keeps the platform schema cleaner. Either way, **add a registry boundary test** that loads every `agent-runtime-*-ts` pack against `loadAgentPack()` and asserts no zod error. Today this fails for 100% of packs — there is zero CI signal.

---

## GAP 3 — Composed `package.json` won't `pnpm install`

`registry/families/agent-platform-ts/files/package.json` declares:

```json
"@tangle-network/sandbox-sdk": "^0.5.0",
"@tangle-network/sandbox-ui": "^0.10.3",
"@tangle-network/tcloud": "^0.4.0"
```

None are on `registry.npmjs.org` (404 from `npm view`). The composed app ships no `.npmrc` pointing at a private registry. The repo's own `~/company/devops/secrets/` does not contain a tangle-network npm token (only `npm.env` for unrelated publish creds).

**Impact**: every fresh `composeStarter({ family: 'agent-platform-ts' })` produces an app that fails `pnpm install` on the very first command in the README's quickstart (`pnpm install`).

**Code-level severity**: low — these deps are unreferenced (only in comments at `src/lib/tangle.ts:2-3,52,55` and `src/client/components/ChatPanel.tsx:5`). The hot path (`chat-bridge.ts`) uses raw `fetch` against `router.tangle.tools` and works without any tangle-network package.

**Operator-experience severity**: high — the user's first interaction with the composed starter is a 404 + an "is not in the npm registry" error. They have no signal that the deps are unused stubs.

### Recommended fix

Either (a) drop the three deps from the registry's `package.json` (the comments referring to them remain TODOs for v2 wiring), or (b) ship a `.npmrc` template that points at the internal Tangle registry with a clear `# Operators: replace AUTH_TOKEN` placeholder. (a) is preferable today since the deps aren't actually used; (b) is the path for when the SDK is genuinely wired.

---

## GAP 4 — Vite-only `?raw` import documented as the registration pattern

`registry/families/agent-platform-ts/files/README.md:78-82`:

```ts
import sysPrompt from '../../../agents/support-bot/system-prompt.md?raw'
import method from '../../../agents/support-bot/methodology/index.json'
registerPack('support-bot', { systemPrompt: sysPrompt, methodology: method, meta: {} })
```

The `?raw` suffix is a Vite primitive. The Cloudflare Worker bundle is built by **wrangler/esbuild**, not Vite. The README acknowledges this in `load-agent-pack.ts:50-54` ("HOWEVER: wrangler doesn't run Vite") but then proceeds to recommend exactly the pattern wrangler doesn't support.

In dogfood I worked around by inlining the system prompt as a TS string export (`pack-recruiter-inline.ts`) — verbose but functional.

### Recommended fix

Either (a) add a build step that converts each `agents/<id>/system-prompt.md` + `methodology/index.json` into a TypeScript module pre-deploy (codegen), or (b) document inlining as the actual canonical pattern. (a) is what the README was reaching for.

---

## What the report does NOT prove

- No streaming-mode test. JSON branch only.
- No multi-tenant test — single token, single tenant.
- No rate-limit eviction test.
- No production-grade auth — used the placeholder HMAC scheme.
- No `wrangler deploy` — local-only run via `wrangler dev`.
- No multi-agent format actually working — by definition, since the loader doesn't support it. The "GAP" is the proof.

---

## Reproducibility

```bash
# 1. Compose
node -e '
  import("/Users/drew/webb/starter-foundry/dist/lib/compose.js").then(m => m.composeStarter({
    spec: { projectName: "dogfood", family: "agent-platform-ts", layers: [], slots: {}, variables: {} },
    outDir: "/tmp/dogfood-platform"
  }))
'

# 2. Strip unresolvable deps + install
cd /tmp/dogfood-platform
node -e '
  const fs=require("fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8"));
  delete p.dependencies["@tangle-network/sandbox-sdk"];
  delete p.dependencies["@tangle-network/sandbox-ui"];
  delete p.dependencies["@tangle-network/tcloud"];
  fs.writeFileSync("package.json", JSON.stringify(p,null,2));
'
pnpm install

# 3. Inline the recruiter pack (because ?raw doesn't work in workerd bundles)
#    — see /tmp/dogfood-platform/src/worker/lib/pack-recruiter-inline.ts in this run

# 4. Stub assets dir + KV id
mkdir -p dist/client && echo '<html>dogfood</html>' > dist/client/index.html
sed -i '' 's/REPLACE_WITH_KV_NAMESPACE_ID/00000000000000000000000000000000/g' wrangler.jsonc

# 5. .dev.vars
cat > .dev.vars <<EOF
TANGLE_ROUTER_KEY=$(dotenvx get TANGLE_ROUTER_API_KEY -f ~/company/devops/secrets/agent-state.env)
AUTH_SECRET=dev-dogfood-secret-please-do-not-ship
EOF

# 6. Run
pnpm wrangler dev --port 8787 --local &

# 7. Mint token + POST
TOKEN=$(node -e '
  const c=require("crypto"); const p={tenantId:"drew-test",exp:Math.floor(Date.now()/1000)+3600};
  const b=Buffer.from(JSON.stringify(p)).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const s=c.createHmac("sha256","dev-dogfood-secret-please-do-not-ship").update(b).digest("hex");
  console.log(b+"."+s);
')
curl -X POST http://localhost:8787/api/chat/recruiter \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"...","history":[]}'
```

---

## Recommendation (highest leverage first)

1. **Implement the multi-agent loader** in `agent-platform-ts/files/src/worker/lib/`. Without this, every `multi-agent-*-ts` template is documentation-only. ~150-250 LOC + tests.
2. **Add a registry boundary test** that loads every `agent-runtime-*-ts` pack against `loadAgentPack()` schema. Today it would fail 100%; after fix it should be a CI gate that blocks any drift.
3. **Drop or replace the unpublished `@tangle-network/*` deps** in `agent-platform-ts/files/package.json`. First-impression matters; the user composes, runs `pnpm install`, gets a 404, and bounces.
4. **Fix the `?raw` README pattern** — either ship the codegen step or document inlining.
5. **Update the platform README** to stop claiming multi-agent capability the worker code does not implement.
