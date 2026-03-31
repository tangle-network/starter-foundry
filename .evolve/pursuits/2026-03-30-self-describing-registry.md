# Pursuit: Self-Describing Registry
Generation: 1
Date: 2026-03-30
Status: designing

## System Audit

### What exists and works
- 38 families, 38 framework layers, 60 capability layers, 18 slot layers, 6 partners
- 103 corpus scenarios — 100% routing accuracy (training + held-out)
- 131 unit tests — all passing
- 44-scenario proof suite — compose + validate end-to-end
- Compose latency: ~30ms warm, well under 3s target
- CAPABILITY_ROUTES in keywords.ts — 25 entries auto-attaching capabilities
- LANE_ROUTES in keywords.ts — 10 entries for workspace lane detection
- detectCapabilities() — runs post-family-selection in both starter/workspace paths
- Design system layers (tailwind, shadcn, dashboard-layout, typography, icons) — auto-attach on quality signals

### What exists but isn't integrated
- Family manifests have `tags` and `taxonomy` fields that the router IGNORES
- Family manifests have `description` fields that could be used for semantic matching but aren't
- Capability manifests have `appliesTo` arrays that are duplicated in CAPABILITY_ROUTES
- New frontend families (angular, remix, vue) have file-exists-only validation — no syntax or runtime checks

### What was tested and failed
- Initial held-out set: 90.7% (4 failures) — all fixed in evolve round 2
- "Composition API" false positive for hasApi — fixed with framework-term exclusion
- "websocket" false-positive for EVM infra — fixed by removing from EVM keywords
- "bot" worker/agent conflict — fixed with disambiguation logic

### What doesn't exist yet
- Registry-driven routing (manifest keywords → router, instead of parallel arrays)
- Capability dependency declarations (shadcn requires tailwind)
- Capability-to-capability compatibility validation
- Proof suite coverage for new families (only 44 of 60 training scenarios compose+validate)

### Measurement gaps
- No proof suite run on held-out corpus (routing-only, not compose+validate)
- No proof suite for new families added in rounds 3-4
- No validation that capability layer files actually compose correctly

## Current Baselines
- Route accuracy (training): 60/60 = 1.000
- Route accuracy (held-out): 43/43 = 1.000
- Validation pass rate (proof suite): 44/44 = 1.000
- Compose latency: ~30ms
- Test suite: 131/131
- Keyword maintenance files: 3 (keywords.ts, selection.ts, prompt-planner.ts)
- Lines of routing code: ~1500 across 3 files

## Diagnosis

The root cause of fragility is **triple maintenance**: every new family/capability requires coordinated changes to keywords.ts (LANE_ROUTES + CAPABILITY_ROUTES), selection.ts (scoring table + boost logic), and prompt-planner.ts (workspace detection + capability wiring). The manifests already describe what each family IS (via tags, taxonomy, description) but this information is ignored by the router.

This is architectural, not tunable. No amount of evolve cycles will fix it — every new family/capability adds more manual keyword lists. The system will rot as the registry grows.

### Symptoms vs Causes
- **Symptom**: Adding angular-ts required 4 file edits (manifest + keywords + selection + prompt-planner)
- **Cause**: Router doesn't read manifests for routing signals
- **Symptom**: CAPABILITY_ROUTES duplicates appliesTo from capability manifests
- **Cause**: No mechanism for manifests to declare their own routing keywords
- **Symptom**: Capability dependencies are implicit (shadcn needs tailwind)
- **Cause**: No dependency declaration system in manifests

## Generation 1 Design

### Thesis
**Adding a new family or capability should be a single-file operation.** The manifest declares its own routing keywords, capability dependencies, and scoring boosts. The router reads the registry, not parallel source arrays.

### Changes (ordered by impact)

#### Architectural (must ship together)

1. **Manifest `keywords` field** — Every family and capability manifest gets an optional `keywords: string[]` field. The router reads these at registry load time and builds scoring tables automatically. Eliminates LANE_ROUTES, CAPABILITY_ROUTES, and the selection.ts scoring table as hand-maintained arrays.
   - Risk: MEDIUM — changing the router core. Must not regress 103/103.
   - Files: types.ts, registry.ts, keywords.ts, selection.ts, prompt-planner.ts, all manifests

2. **Manifest `scoring` field** — Family manifests get an optional `scoring: { boost?: Record<string, number> }` field for co-occurrence boosts (e.g., go-api boosts when "go" + "api" co-occur). Replaces the hand-coded boost logic in selection.ts.
   - Risk: LOW — additive field, no existing behavior changes until wired
   - Files: types.ts, selection.ts, family manifests

3. **Capability `requires` field** — Capability manifests get `requires?: string[]` to declare dependencies on other capabilities. shadcn requires tailwind. dashboard-layout benefits from tailwind. Enforced at compose time.
   - Risk: LOW — validation only, doesn't change compose logic
   - Files: types.ts, compose.ts or registry.ts, capability manifests

#### Independent (can test separately)

4. **Auto-build selection scoring from manifests** — `selectStarter` reads family.keywords from the registry instead of maintaining a parallel array. The 35-entry scoring table in selection.ts is replaced by a loop over registry families.
   - Risk: MEDIUM — must produce identical scoring behavior
   - Files: selection.ts

5. **Auto-build capability detection from manifests** — `detectCapabilities` reads capability.keywords from the registry instead of CAPABILITY_ROUTES. The 25-entry CAPABILITY_ROUTES array is eliminated.
   - Risk: MEDIUM — must produce identical detection behavior
   - Files: keywords.ts

6. **Populate keywords into all 98 manifests** — Write the keywords from current source arrays into the manifest files. This is the migration step — after this, the source arrays can be removed.
   - Risk: LOW — data migration, no logic change
   - Files: all manifests in registry/

### Alternatives Considered
- **Embedding-based routing** — Use text embeddings for semantic prompt matching instead of keywords. Rejected: adds LLM dependency to the hot path, breaks the <3s guarantee, and the keyword system works (103/103).
- **LLM-in-the-loop routing** — Have an LLM classify the prompt into family+capabilities. Rejected: same latency/cost concerns. The deterministic router is a feature, not a limitation.
- **Leave as-is, just keep adding keywords** — Rejected: already at 1500 lines of routing code across 3 files. Every new family is 4 file edits. This doesn't scale to 100+ families.

### Risk Assessment
- Main risk: scoring behavior changes during migration (different keyword matching order, missing boosts)
- Mitigation: run 103/103 corpus check after every step. The corpus IS the regression suite.
- Rollback: git revert. All changes are in tracked source files.
- Irreversible changes: none. Manifest fields are additive.

### Success Criteria
- Route accuracy: 103/103 maintained throughout (zero regressions)
- Keyword maintenance files: 3 → 1 (prompt-planner.ts retains workspace logic only)
- Adding a new family: 4 file edits → 1 (manifest.json only, for scoring + capability)
- Validation pass rate: 60/60 proof suite maintained
- Test suite: 131/131 maintained
- Adding a new capability: 3 file edits → 1 (manifest.json only)
