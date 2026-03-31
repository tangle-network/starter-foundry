# Pursuit: Scoring Hierarchy
Generation: 3
Date: 2026-03-30
Status: evaluated

## System Audit

### Bug found during audit
"Build a Next.js SaaS dashboard with shadcn/ui" → frontend-static because "dashboard" + "ui" (2pts) beat "next.js" (1pt). Fixed by trimming frontend-static keywords and adding explicit framework boosts. But this exposed a deeper design problem.

### Root Cause
Keywords are flat — "next.js" and "dashboard" score equally (1 point each). But "next.js" is an **explicit framework request** while "dashboard" is a **generic feature descriptor**. The scoring system treats them the same. Every new generic word added to any family risks creating the same collision.

### What was built in response
1. Trimmed frontend-static to genuinely-static keywords only
2. Added +3 boosts for explicit framework names (next.js, svelte, remix, vue, angular)
3. Added React Native exclusion from React boost
4. Verified end-to-end: "Next.js SaaS dashboard with shadcn" → nextjs-ts with 18 files composed

### Diagnosis
The boost system works but is manual. Every new collision requires a new hand-coded boost rule. The real fix would be a **keyword tier system** where:
- Tier 1 (family name, framework name): +3 base score
- Tier 2 (domain term, specific tech): +1 base score (current)
- Tier 3 (generic descriptor): +0.5 or needs co-occurrence

This would prevent generic words from ever beating explicit framework names. But it requires changing the manifest schema (keywords → tiered keywords) which is a bigger change.

### Decision
NOT pursuing tiered scoring as Generation 3. The manual boost system is working (103/103, 131/131) and the keyword collisions are now well-understood. The next generational bet should be on **user experience quality** — what the composed project actually looks like — not routing precision which has converged.

### Verdict: ADVANCE (as a hotfix, not a generation)
The bug fix shipped. The system is stable. Tiered scoring is a future generation if collisions become frequent with real user traffic.
