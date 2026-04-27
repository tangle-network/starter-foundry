# Mathematical Reasoning Template

## Purpose
Walk a researcher or learner through structured exploration of a
conjecture: state precisely, test small cases, find structural
patterns, generalize, attempt proof or refutation. The output is
not a finished proof — it's the reasoning chain the user can build
on.

## When to use
Trigger when the user has a conjecture, a half-formed claim, or a
"is this true?" question. For verifying a claimed proof, use
proof-verification.md. For finding existing results, use
literature-review.md.

## Method

1. **Restate the conjecture precisely.**
   - All quantifiers explicit (`for all n in N`, `there exists`).
   - All hypotheses on the objects (compact, smooth, simply
     connected, finite, abelian).
   - All operations defined (specify the category / structure).
   - Imprecision here propagates to wasted effort downstream.
2. **Check small cases systematically.**
   - For natural numbers: n = 1, 2, 3, 4, 5 minimum; extend until
     a pattern emerges or the conjecture fails.
   - For graphs: K_3, K_4, P_n, C_n, the Petersen graph.
   - For groups: cyclic, dihedral, symmetric, alternating, simple.
   - For varieties: P^n, products, blow-ups, conics.
   Use the canonical "small zoo" of examples in the relevant area.
3. **Look for counterexamples.**
   - Boundary cases: n=0, n=1, the trivial group, the empty
     graph.
   - Pathological examples: long-thin / fat / disconnected /
     non-simply-connected; for analysis, the dyadic / Cantor /
     Weierstrass-style constructions.
   - The conjecture's hypotheses tell you where to look — drop
     a hypothesis and see what breaks.
4. **Reason by analogy.**
   - Find a similar known theorem; understand why its proof
     works.
   - Identify what changes between the analog and the
     conjecture; that's where the new idea has to do work.
5. **Try standard proof strategies.**
   - **Induction** on n / dimension / cardinality.
   - **Contradiction** — assume not, derive impossibility.
   - **Contrapositive** — sometimes cleaner than direct.
   - **Direct computation** — when there's structure to exploit.
   - **Algebraic vs combinatorial vs topological vs analytic**
     reformulation — moving to a different category sometimes
     unlocks the proof.
   - **Functorial / categorical lift** — factor through a
     better-behaved object.
6. **Identify the obstruction.**
   - If a proof attempt fails, articulate *why*: what step
     can't be made rigorous? That obstruction is data — it
     points to which hypothesis matters or which counterexample
     to seek.
7. **Generalize or specialize.**
   - **Generalize**: drop a hypothesis. Often the more general
     statement is easier to prove (Polya: "the more general
     problem may be easier").
   - **Specialize**: add hypotheses to a tractable subcase. If
     a special case is open, the general case is harder.
8. **Document the chain.** Reasoning is a record of attempts,
   not just the successful path. Document failed approaches and
   the obstruction — they save the next person time.

## Worked example sketch

> Conjecture: every even integer ≥ 4 is the sum of two primes
> (Goldbach).
>
> Small cases: 4=2+2, 6=3+3, 8=3+5, 10=3+7=5+5, 12=5+7,
> 14=3+11=7+7, ..., 100=3+97=11+89=...
>
> Patterns: many representations per number; representations
> grow roughly as N/(log N)^2 — heuristic from prime density.
>
> Status: open problem; verified by computer up to ~4×10^18.
>
> Adjacent results: weak Goldbach (every odd integer ≥ 7 is sum
> of three primes) — proved by Helfgott (2013).
>
> Reasoning: the heuristic argument predicts representations
> grow without bound, making counterexamples vanishingly rare;
> rigorous proof requires either deep analytic-number-theory
> tools or a structural argument no one has yet found.

## Discipline rules

- **Precision before speed.** A misstated conjecture wastes all
  downstream work.
- **Examples before theorems.** Most working mathematicians
  test 5+ examples before committing to a proof attempt.
- **Counterexamples are wins.** A counterexample resolves the
  question; treat it as success, not failure.
- **No hand-wavy proofs.** "It's clear that…" usually hides
  the part the agent should expand.
- **No invented citations.** If a result is needed and the
  agent can't find it, mark it "needs citation" and route to
  literature-review.md.

## Output

```
:::artifact
template: mathematical-reasoning
conjecture: "..."
hypotheses: [...]
small-cases: [...]
attempted-proofs:
  - { strategy: "induction", obstruction: "..." }
  - { strategy: "...", obstruction: "..." }
counterexamples-tried: [...]
analogous-results: [...]
status: "proven" | "disproven" | "open" | "in-progress"
:::
```

## Refusal

The agent will not:
- Claim a proof when only sketch / heuristic is offered.
- State a conjecture as proven without citation.
- Fabricate theorem attributions or "well-known" results.
