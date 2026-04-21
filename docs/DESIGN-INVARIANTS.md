# Design invariants — what's agentic, what isn't, and why

This repo sits between a user prompt and a composed scaffold. Some layers
MUST be deterministic (latency, reproducibility, auditability). Some MUST
be agentic (scales with content breadth, benefits from evidence-driven
synthesis). Mixing the two up is how we sloppify.

## The contract

| Surface | Shape | Why |
|---|---|---|
| `planPrompt` routing hot path | Deterministic | p95 0.5ms, reproducible, audit-friendly. LLM here = regression. |
| Compose (file writing + variable interpolation) | Deterministic | Mechanical. |
| Registry keyword → capability mapping | Deterministic (data-derived) | Audit-friendly. Keywords curated from mined agent behavior, not LLM-generated at plan time. |
| Gap detector (`scripts/infer-capability-gaps.mjs`) | Deterministic analysis | Data, not generation. |
| AGENTS.md rendering (the template, `src/lib/compose.ts#buildAgentsMd`) | Deterministic | Same content every time for the same spec. Agents pattern-match on structure. |
| AGENTS.md content in `buildHints.firstSteps / gotchas / placeholders` | Agentic (LLM drafts, human reviews) | Scales with family/partner count. Evidence: rewrite mining + audit output. |
| Template ship files (`registry/**/files/*`) | Agentic (mine → synthesize → judge → promote) | Evidence: rewrite-miner tuples. See `src/training/template_v1/`. |
| Partner configs (addresses, SDK names, gotchas) | Agentic (LLM reads partner docs) | Scales with partner count. Evidence cross-reference against public READMEs. |
| Extension generators (`pnpm new family/partner/capability`) | Hybrid: deterministic scaffolding + LLM-drafted initial hints | Contributor enters a one-line description; generator writes the boilerplate, LLM drafts the semantic slots. |
| Gap-fix PR body | Agentic (LLM drafts) | Summarizing detector output to prose. |

## Rules that fall out

1. **Don't hand-craft template ship files.** Every new `registry/**/files/*.ts` or similar = evidence of a missing automation. If you caught yourself writing one, open an issue to point the template-quality loop at it instead.
2. **Don't add keywords at plan time.** All routing keywords live in `FamilyManifest.tieredKeywords` / `LayerManifest.keywords`. The planner reads the registry; it doesn't hardcode.
3. **Don't add a metric without a `productValueClaim`.** The claim answers "if this number moves, what user-visible outcome moves with it?" Scorecard flows without a claim are proxy metrics and will be rejected by the governor.
4. **Don't ship a registry change without a measured delta.** PRs touching `registry/` run the buildout pipeline + gap detector and report the before/after in the PR body. CI gate enforces this.
5. **Don't fabricate seed data.** If a script name says "scrape," it fetches real sources. If you need to seed, name the script `seed-*` and document that the content is hand-written.

## How to tell which side a surface belongs on

Ask: **does evidence exist for the content?**
- Agent-behavior data (rewrites, installs, outcomes) → agentic.
- Spec / runtime / protocol documentation → hybrid (LLM drafts from docs, human verifies).
- Latency budget ≤ 5ms → deterministic, always.
- Test-observable contract (routing, compose output shape) → deterministic, always.

## The anti-patterns (we've hit all of these)

- **"I'll hand-craft this registry entry for now, and we'll automate it later."** Later never comes. Either open the PR for the automation or don't add the surface.
- **"This metric seems like it's probably useful."** Empty `productValueClaim` = will be deleted at the next cleanup pass.
- **"Let me add a keyword to the planner code to unblock this prompt."** Keywords belong in manifests, not in `src/lib/planner/*.ts`. If the type doesn't support it, extend the type.
- **"I'll write a scraper that returns canned data for now."** That's not a scraper. Name it `seed-*` and accept the debt — or build the real one.
