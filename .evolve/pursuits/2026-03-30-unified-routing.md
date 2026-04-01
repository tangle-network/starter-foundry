# Pursuit: Unified Routing Architecture
Generation: 5
Date: 2026-03-30
Status: designing

## System Audit

### The problem
2008 lines of routing code across 3 files with 6 competing mechanisms:

1. **Product archetypes** (132 entries in prompt-planner.ts) — pattern → family lookup
2. **Keyword scoring** (38 families × N keywords each, in manifests) — sum of keyword hits
3. **26 boost rules** (selection.ts) — hand-coded score adjustments
4. **10 lane overrides** (prompt-planner.ts) — detectLane → family override after scoring
5. **Design system auto-attach** (prompt-planner.ts) — tailwind/shadcn on quality signals
6. **Workspace builder** (prompt-planner.ts) — 67 signal checks for multi-project detection

When a prompt fails, it's nearly impossible to trace which layer caused it. When we fix a failure, we add to whichever layer is convenient, making the next failure harder to debug.

### Root cause
The routing grew organically: keywords first, then boosts for collisions, then archetypes for product names, then fuzzy matching for typos, then design system signals. Each was a reasonable fix in isolation. Together they're a house of cards.

### What a clean architecture looks like
One unified scoring pipeline where every signal is the same type — a weighted keyword match — processed in one pass. No separate archetype table. No boost rules. No lane overrides. The family manifest declares everything: keywords, weight tiers, and default capabilities.

## Generation 5 Design

### Thesis
**Collapse 6 routing layers into 1.** Every routing signal — framework names, product patterns, domain terms, generic descriptors — lives in the family manifest as tiered keywords. One scorer, one pass, deterministic and traceable.

### The new manifest keyword schema

```json
{
  "keywords": {
    "tier1": ["next.js", "nextjs", "next js"],
    "tier2": ["app router", "server action", "seo app"],
    "tier3": ["dashboard", "landing", "app"],
    "archetypes": ["notion", "linear", "jira", "cms", "blog platform"]
  }
}
```

- **tier1** (weight 4): Framework names, product-specific terms. "next.js" is unambiguous.
- **tier2** (weight 2): Domain-specific terms. "app router" strongly suggests Next.js.
- **tier3** (weight 1): Generic terms. "dashboard" alone is weak but contributes.
- **archetypes** (weight 3): Product names/patterns. "notion" → this family. These replace the PRODUCT_ARCHETYPES array.

Score = Σ(tier1 × 4) + Σ(tier2 × 2) + Σ(tier3 × 1) + Σ(archetypes × 3)

The highest-scoring family wins. No boosts. No overrides. No separate archetype lookup.

### Changes

#### Architectural (must ship together)

1. **New keyword schema in manifests** — Replace flat `keywords: string[]` with tiered `keywords: { tier1, tier2, tier3, archetypes }`. Migrate all 38 family manifests.

2. **Unified scorer** — Replace `selectStarter` (keyword scoring + 26 boosts) with a single weighted scorer that reads tiered keywords from manifests. ~50 lines replacing ~250.

3. **Merge archetypes into manifests** — The 132 PRODUCT_ARCHETYPES entries move into the `archetypes` tier of the appropriate family manifest. The separate archetype table and `resolveProductArchetype` function are deleted.

4. **Merge lane overrides into scoring** — The 10 `detectLane → family override` blocks in planPrompt become unnecessary because tier1 keywords (framework names) already score high enough to win. Delete the override blocks.

5. **Merge design system auto-attach into capability detection** — The tailwind/shadcn auto-attach block becomes unnecessary because capability manifests already have keyword detection. Add "professional", "polished", "production-ready" to the tailwind capability manifest keywords.

6. **Simplify workspace detection** — The 67-signal workspace builder stays (it's workspace-specific logic, not family scoring), but the `fitsFullstackStarter` / `plainProtocolProject` / `plainAgentService` guards are replaced by a simpler rule: "if only one domain detected, it's a starter."

### What gets deleted

| Current | Lines | Replaced by |
|---------|-------|-------------|
| PRODUCT_ARCHETYPES array | ~200 | Manifest `archetypes` field |
| 26 boost rules in selection.ts | ~100 | Tiered keyword weights |
| 10 lane override blocks in planPrompt | ~80 | Tier1 keywords winning naturally |
| Design system auto-attach block | ~20 | Capability manifest keywords |
| resolveProductArchetype function | ~10 | Deleted |
| fuzzyKeywordScore fallback | ~20 | Stays (typo tolerance is orthogonal) |
| **Total deleted** | **~430** | |

### What stays

- Workspace builder (multi-project detection) — different problem, kept separate
- Capability detection from manifests — already clean
- Fuzzy fallback for typos — orthogonal, stays
- Build plan generation — downstream of routing, unaffected
- Slot detection (database, auth, payments, queue, sdk) — stays in prompt-planner

### Success criteria

- 103/103 corpus maintained (zero regressions)
- 131/131 tests maintained
- 35/35 real-world prompts maintained
- Routing code: 2008 lines → < 1200 lines
- Routing layers: 6 → 2 (unified scorer + workspace builder)
- Adding a new family: edit 1 file (manifest.json) — currently requires checking 3+ files
- Every routing decision traceable to one score calculation

### Risk assessment

- **Main risk**: Tiered weights produce different rankings than the current boost system for edge cases
- **Mitigation**: Run corpus after EVERY manifest migration, catch regressions immediately
- **Rollback**: Git revert. All changes are in tracked files.
