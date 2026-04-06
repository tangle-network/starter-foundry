# Spec: Design Personalization for blueprint-agent

**Audience:** blueprint-agent team
**Author:** starter-foundry
**Replaces:** SPEC-design-personalization.md (deleted — wrote it without reading your code)
**Status:** ready for review
**One-line summary:** ship a `personalize.css` file via the existing scaffold tarball / enrichment loop. No new infrastructure.

---

## What I got wrong in v1, and what changed

The v1 spec invented a `design-tokens.json` contract, a Vite plugin, a separate `personalize` step, and a `src/scaffold/` directory tree. None of those exist or fit your architecture. After reading:

- `scripts/experiments/lib/enrichment.ts`
- `scripts/experiments/scaffold-builder.ts`
- `apps/web/src/lib/.server/scaffolds/index.ts` (the only production scaffold file, 137 LoC)
- `scripts/experiments/lib/types.ts` (`LifecycleTimings`)
- `scripts/experiments/scaffold.ts` (`TOP_TEMPLATES`)
- `docs/scaffold-gen2-spec.md`
- `docs/instant-layouts-spec.md`
- `docs/starter-foundry-integration-report.md`

…the right answer is **much smaller**. Personalization is one CSS file, written by either the bake-time enrichment agent or the runtime session agent, using mechanisms you already have. Zero new modules.

---

## How starter-foundry does personalization (already shipped)

Already in `main` of `tangle-network/starter-foundry`:

1. **10 industry layers** under `registry/layers/industry/{fitness,saas,crypto,restaurant,creative,ecommerce,health,education,finance,gaming}/`. Each has a `manifest.json` with keywords and a `personalize.css` with HSL color overrides.

2. **`detectIndustry()`** in `src/lib/keywords.ts` mirrors `detectCapabilities()` exactly. Same scoring, same shape, same registry traversal. Attached to `spec.layers` automatically by `prompt-planner.ts`.

3. **The compose pipeline writes `personalize.css`** to `src/personalize.css` (Vite) or `app/personalize.css` (Next.js). The framework's `main.ts` / `layout.tsx` imports it after `styles.css`/`globals.css`.

4. **The CSS mechanism** — Tailwind v4's `@theme` block emits CSS custom properties at runtime. A later `:root` block wins via cascade. No regex, no parser, no build step. Verified working: composing with `industry:fitness` produces an orange `Get Started` button instead of blue.

5. **Public exports** in the `starter-foundry` npm package:
   ```ts
   import {
     detectIndustry,        // (text, family, registry) => 'industry:fitness' | null
     listIndustries,        // () => Promise<IndustryInfo[]>
     getIndustry,           // (id) => Promise<IndustryInfo | null>
     PERSONALIZE_CSS_PATHS, // { vite: 'src/personalize.css', nextjs: 'app/personalize.css' }
   } from 'starter-foundry'
   ```

   `IndustryInfo` shape:
   ```ts
   interface IndustryInfo {
     id: string             // 'fitness'
     description: string    // 'Fitness, training, gym, workout, and athletic apps'
     keywords: string[]     // ['fitness', 'gym', 'workout', ...]
     tone: string           // 'energetic, direct, motivational'
     paletteCssPath: string // 'src/personalize.css'
   }
   ```

6. **`ComposeEvent`** now includes `industry: string | null` so consumers can read which industry was selected:
   ```ts
   import { on } from 'starter-foundry/telemetry'
   on('compose', (e) => {
     console.log(e.family, e.industry, e.layers, e.durationMs)
   })
   ```

**Status:** all in `main`, tests pass (347/347), npm publish pending your username/access decision.

---

## The contract — single file, single mechanism

`personalize.css` lives at one of two paths in any composed scaffold:

- `src/personalize.css` (Vite, react-vite-ts)
- `app/personalize.css` (Next.js app router, nextjs-ts)

Its content is one or two `:root` blocks overriding Tailwind v4 CSS custom properties:

```css
:root {
  --color-primary: hsl(14 90% 53%);
  --color-accent: hsl(45 96% 56%);
  --color-ring: hsl(14 90% 53%);
}
.dark {
  --color-primary: hsl(14 90% 53%);
  --color-accent: hsl(45 96% 56%);
  --color-ring: hsl(14 90% 53%);
}
```

That's it. **The CSS file is the contract.** Anything that wants to personalize a scaffold writes this file. starter-foundry writes the industry default; blueprint-agent writes per-template (bake time) or per-user (runtime) overrides.

No JSON schemas to keep in sync. No types to import. No build step. The same file in the same place, written by whichever process knows the user's preferences.

---

## Where personalization plugs into blueprint-agent

You have three integration points. They are not mutually exclusive — each addresses a different audience.

### Point A: Bake-time enrichment (per-template, runs once per `TOP_TEMPLATES` entry)

**File:** `scripts/experiments/scaffold-builder.ts`
**Function flow:** `composeBases()` → `composeStarter()` → agent enrichment → tarball

**Today** (line 128): `await starterFoundry.composeStarter({ spec, outDir })` produces a base scaffold with the **industry-default** `personalize.css` already written if the prompt matched an industry.

**The enhancement:** add a one-line system prompt addition to the enrichment agent so it customizes `personalize.css` for the template's specific purpose before building features.

**Concrete change** in the agent prompt at `scaffold-builder.ts:530`:

```diff
First run: ls /home/agent/ && cat /home/agent/AGENTS.md

AGENTS.md contains the exact build plan. Implement it.

${config.prompt}

RULES:
- ALL files go in /home/agent/ — NEVER create a subdirectory for the project
- Read AGENTS.md for pages, API routes, components to build
+ - The scaffold ships with src/personalize.css (or app/personalize.css for Next.js).
+   Before building features, rewrite this file with a color palette that fits
+   the template's purpose. Use HSL CSS custom properties. The file overrides
+   Tailwind v4 @theme defaults via :root cascade — see existing content for format.
- shadcn/ui components are in src/components/ui/ — use them
- After implementing: cd /home/agent && pnpm install && pnpm build
```

That's the entire bake-time integration. The agent already has full file-write tools, retry, and build validation. Personalization becomes one bullet in the existing prompt.

**Cost:** zero new files, ~5 lines of prompt. Adds maybe 1-2 turns to enrichment per template (one to read `personalize.css`, one to write it).

**What this gives users:** every template tarball ships with a palette that matches the template (e.g. `solana-amm-dex` gets emerald, `coinbase-ecommerce` gets blue, `marathon-training` gets orange). Same tarball for all users of that template, but distinctively designed per template.

### Point B: Runtime session enrichment (per-user, runs once per session)

**File:** `apps/web/src/lib/.server/scaffolds/index.ts` (also `getScaffoldContext()`)
**Where personalization fires:** in the agent system message after the tarball is extracted, before the user's prompt is processed.

**Today** (line 127): `getScaffoldContext()` returns a context message snippet telling the agent the scaffold is loaded.

**The enhancement:** extend the snippet to instruct the agent to rewrite `personalize.css` based on the user's prompt.

**Concrete change** in `getScaffoldContext()`:

```diff
 export function getScaffoldContext(name: string): string | null {
   if (!hasScaffold(name)) return null
   return [
     'A working project scaffold is set up with dependencies installed and dev server starting.',
     'Make the minimum set of file edits needed to satisfy the user request.',
     'Do not spend time on broad repo exploration.',
     'If shadcn/ui components are available (src/components/ui/), use them instead of raw HTML.',
+    'Before adding features, rewrite src/personalize.css (or app/personalize.css) with a color palette that fits the user\'s product. Use HSL CSS custom properties on :root. The file overrides Tailwind v4 @theme defaults — see its existing content for format.',
     'After writing UI code, screenshot the preview to verify it renders correctly. Fix any unstyled elements before responding.',
   ].join(' ')
 }
```

**Cost:** one line. Same agent, same tools, no new dispatch.

**What this gives users:** every user gets a palette tailored to their specific prompt. Two users picking the same template get visually different scaffolds. The bake-time default acts as the floor; the runtime pass refines it.

### Point C: Pure starter-foundry routing (no agent needed)

**File:** `scripts/experiments/scaffold-builder.ts:128` already calls `composeStarter()`

**Today:** if the template's prompt mentions "fitness" or "saas" or any other industry keyword, `prompt-planner.ts` already attaches the matching industry layer and writes the corresponding `personalize.css`. **This works today, no changes needed.**

**Verification:** for every entry in `TOP_TEMPLATES`, run `starterFoundry.planPrompt({ prompt: <template-prompt>, partner: null })` and check that `spec.layers` contains an `industry:*` entry. Templates whose prompts don't match any industry get the framework's default empty `personalize.css` (which is fine — the cascade just falls through to `@theme` defaults).

**Cost:** zero. This is already in the pipeline.

---

## Recommended sequence

1. **Today: confirm Point C is working** — add a log line in `composeBases()` that prints `industry || 'none'` per template. Visual sanity check across all 81 templates in `AVAILABLE_SCAFFOLDS`.
2. **This week: ship Point A** — 5-line prompt addition in `scaffold-builder.ts`, rebuild a few `TOP_TEMPLATES` tarballs, manually inspect that the agent rewrote `personalize.css` and the build still passes.
3. **Next week: ship Point B** — 1-line prompt addition in `getScaffoldContext()`. Test in dev with a few prompts of varying industry signal.
4. **Optional later: image generation** — out of scope here, separate spec.

Total surface area: ~6 lines of prompt across 2 files. No new modules.

---

## TOP_TEMPLATES vs. starter-foundry industry prompts

You raised this in feedback. Here's the reality:

`TOP_TEMPLATES` in `scripts/experiments/scaffold.ts:45` is **a benchmark subset of the 81 entries in `AVAILABLE_SCAFFOLDS`**. It's used to validate that the top-traffic templates pass validation; it's not an industry prompt list.

The starter-foundry industry detection runs over **the prompt that gets passed to `composeStarter`**, which for `coinbase-ecommerce` is something like *"Build a Coinbase Web3 e-commerce store with Commerce API and Wallet SDK"*. That prompt routes to `industry:ecommerce` automatically. No lookup table needed, no synchronization required between `TOP_TEMPLATES` and an industry list.

**Action:** delete the v1 spec's "10 industry test prompts" list. They were redundant. Use your existing template prompts as the source of truth.

---

## Telemetry — extending `LifecycleTimings`

Today (`scripts/experiments/lib/types.ts:9-86`) `LifecycleTimings` captures every checkpoint from `requestSentAt` to `benchmarkEndAt`. Personalization should plug in here, not invent a parallel measurement system.

**Proposed additions** to `LifecycleTimings`:

```diff
 export interface LifecycleTimings {
   ...
   /** Scaffold path taken */
   scaffoldPath: 'curated' | 'compose' | 'none' | null
+
+  // Personalization (Point A: bake-time, Point B: runtime)
+  /** Industry detected by starter-foundry from the prompt */
+  detectedIndustry: string | null
+  /** Agent rewrote personalize.css during enrichment */
+  personalizeRewrittenAt: number | null
+  /** Personalization fell back to industry default (agent skipped or failed) */
+  personalizeFallbackUsed: boolean
+
   ...
 }
```

`detectedIndustry` is read from the `compose` event starter-foundry now emits (`e.industry`). `personalizeRewrittenAt` is set when the agent's tool-call stream contains a `write_file` for `*/personalize.css` after the initial scaffold extraction. `personalizeFallbackUsed` is true if the timing is null at session end.

The `bench` runner already captures tool calls with names — adding these fields is ~10 lines in `lifecycle-timer.ts`.

---

## Eval — extending the existing benchmark, not building a new one

The v1 spec proposed a "3-stage scorecard" with separate runs. Reality: you already have `bench`, `scaffold`, and `bad design-audit`. Wire them together.

**Proposed addition** to `scripts/experiments/scaffold.ts`:

After each template's enrichment run, capture:
1. `industry` from the `compose` event (already available via the new field)
2. Diff of `personalize.css` before vs after enrichment (was it rewritten?)
3. `bad design-audit` score against the running container's preview URL (already happens for some flows)

Then in `results/<run-id>/results.json`, add per-template:
```json
{
  "templateName": "coinbase-ecommerce",
  "industry": "industry:ecommerce",
  "personalizeRewritten": true,
  "designAuditScore": 5,
  "designAuditFindings": 22
}
```

That's the eval. No new script, no parallel measurement infrastructure. The existing scaffold.ts harness gains 3 fields.

**Success criterion:** average `designAuditScore` across `TOP_TEMPLATES` improves measurably after Point A ships (currently ~4-5/10 on `vibecoded` profile per starter-foundry's own audits). Target: 6+/10 average.

---

## Open questions for the blueprint-agent team

These are things I cannot answer from outside your repo. Decide and tell me:

1. **Does the bake-time agent (`scaffold-builder.ts`) have permission to read `personalize.css` and write it back?** I think yes from reading the code, but want to confirm there's no sandbox restriction on modifying `src/` or `app/` paths.

2. **Should the runtime agent (Point B) be allowed to rewrite `personalize.css` for templates that didn't match an industry at bake time?** If yes, this is the most impactful change — every user gets per-prompt personalization. If no, only templates that were already industry-tagged get runtime refinement.

3. **Is `getScaffoldContext()` the right place to add the prompt addition, or should it live in the agent's system message in `apps/web/src/lib/.server/chat/`?** I couldn't find the system-message file definitively from the docs.

4. **Do you want the bake-time pass to verify `personalize.css` is valid CSS?** I'd argue no — the existing `pnpm build` validation catches CSS parse errors via Tailwind's PostCSS plugin.

5. **For the 81 templates in `AVAILABLE_SCAFFOLDS` not in `TOP_TEMPLATES`, when do their tarballs get rebuilt with the new personalization prompt?** Is there a "rebuild all" path I missed in `scaffold-builder.ts`?

6. **Should `personalize.css` be visible to the user in the file tree, or hidden?** It's just CSS — I'd vote visible so power users can edit it directly. But if your IDE filters hidden the `.starter-foundry/` dir, similar treatment may apply.

---

## What starter-foundry will do next (in case you ask)

Already shipped (today, in `main`):
- 10 industry layers with `personalize.css`
- `detectIndustry()` in keywords
- prompt-planner attaches industry to spec
- compose writes `personalize.css` via the existing layer mechanism
- Framework `main.ts`/`layout.tsx` imports the file
- Default empty `personalize.css` ships with frameworks (handles the no-industry case)
- `listIndustries()`, `getIndustry()`, `PERSONALIZE_CSS_PATHS` exported from `starter-foundry`
- `ComposeEvent.industry` field for telemetry
- 4 new tests, all 347 pass

Will do if you need it:
- Publish to npm as `starter-foundry` (waiting on auth)
- Add more industries (telemetry-driven — wait for production data)
- Refine palettes based on `bad design-audit` scores
- Add a `presets` field to industry manifests for variant palettes ("fitness/dark", "saas/playful")
- Document the `personalize.css` mechanism in the README (1 paragraph)

Will **not** do (unless you ask):
- Rebuild the variant system to vary by industry (over-engineering)
- Add an LLM call inside starter-foundry (defeats the speed goal)
- Add image generation (belongs in blueprint-agent)
- Add token JSON contract (the CSS file IS the contract)
- Touch any of the 81 template tarballs (your bake pipeline owns those)

---

## File reference index

Everything I'm pointing at, in one place:

**starter-foundry (this side):**
- `registry/layers/industry/<id>/manifest.json` — 10 industry definitions
- `registry/layers/industry/<id>/files/personalize.css` — 10 palette files
- `registry/layers/framework/{nextjs-app-router,react-vite-ts}/files/personalize.css` — empty defaults
- `registry/layers/framework/react-vite-ts/files/main.ts` — imports personalize.css
- `registry/layers/framework/nextjs-app-router/files/layout.tsx` — imports personalize.css
- `src/lib/keywords.ts:detectIndustry()` — detection
- `src/lib/industries.ts` — public API for blueprint-agent
- `src/lib/prompt-planner.ts:958-962` — attaches industry layer
- `src/lib/compose.ts:101-110` — emits industry in ComposeEvent
- `src/lib/index.ts` — public exports
- `src/lib/telemetry.ts:30-37` — ComposeEvent type

**blueprint-agent (your side):**
- `scripts/experiments/scaffold-builder.ts:128` — calls composeStarter, passes prompt
- `scripts/experiments/scaffold-builder.ts:530-545` — bake-time agent system prompt (Point A)
- `scripts/experiments/lib/enrichment.ts:32` — runEnrichment(templateName, backend)
- `apps/web/src/lib/.server/scaffolds/index.ts:127` — getScaffoldContext (Point B)
- `scripts/experiments/lib/types.ts:9-86` — LifecycleTimings (telemetry extension)
- `scripts/experiments/scaffold.ts:45` — TOP_TEMPLATES
- `apps/web/src/lib/.server/scaffolds/index.ts:17-103` — AVAILABLE_SCAFFOLDS (81 entries)

---

## Hand-off summary

The mechanism is shipped on starter-foundry's side. Your work is:

1. **5 lines** in `scaffold-builder.ts:530` — add personalize.css instruction to bake-time agent
2. **1 line** in `apps/web/src/lib/.server/scaffolds/index.ts:127` — add it to runtime context
3. **3 fields** in `scripts/experiments/lib/types.ts` — telemetry plumbing
4. **3 fields** in `scripts/experiments/scaffold.ts` results — eval integration
5. **Decisions** on the 6 open questions above

Total LoC: <30. No new modules. No parallel infra. The CSS file is the contract.

If anything in this spec doesn't match your code, tell me — I'll fix it immediately. I'm one repo over.
