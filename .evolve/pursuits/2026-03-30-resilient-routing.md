# Pursuit: Resilient Routing
Generation: 2
Date: 2026-03-30
Status: building

## Diagnosis

Two structural failures exposed by adversarial testing:

1. **Product reference blindness**: "Build me a Twitter clone" → frontend-static. Vibecoders reference products, not frameworks. The router has zero product knowledge.
2. **Typo fragility**: "Ract" ≠ "react". One character breaks keyword matching completely.

## Generation 2 Design

### Thesis
**The router should understand what users MEAN, not just what they TYPE.** Product archetypes handle semantic intent. Fuzzy matching handles human error.

### Changes

1. **Product archetype table** — Map known products/apps to project archetypes with family + capability recommendations. "Twitter clone" → fullstack-ts + realtime-ws + saas-teams.
2. **Fuzzy keyword matching** — Levenshtein distance ≤ 2 on single-word keywords. "Ract" matches "react". "pytohn" matches "python".
3. **Adversarial corpus** — Add 30+ adversarial scenarios to held-out validation.

### Success Criteria
- Product reference accuracy: 0/6 → ≥ 5/6
- Typo tolerance: 1/4 → ≥ 3/4
- Zero regressions on existing 103 corpus
- Zero regressions on 131 test suite
