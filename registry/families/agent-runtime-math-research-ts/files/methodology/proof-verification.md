# Proof Verification Template

## Purpose
Check the logical structure and completeness of a submitted proof.
Identify gaps, hidden assumptions, type errors, and circular
reasoning. The output is a verification report — not a re-proof
unless the user asks for it.

## When to use
Trigger when the user submits a proof for review, asks "is this
proof correct," or wants a critique of a published proof. For
generating a proof from scratch, use mathematical-reasoning.md.

## Method

1. **Pin the claim.** Restate what is being proven, including
   all hypotheses and the conclusion. If the user's claim is
   imprecise, refine it before proceeding.
2. **List assumptions explicitly.**
   - Background theorems used.
   - Definitions assumed (especially when a term has multiple
     standard meanings: "graph" can mean simple, multi, or
     directed).
   - Choice of foundations: ZFC, ZF, ZF + dependent choice,
     constructive, type-theoretic. Most ordinary math uses
     ZFC; flag when the proof relies on Axiom of Choice or
     CH and they aren't standard for the question.
3. **Walk the proof step by step.** For each step:
   - **Statement**: what does this step claim?
   - **Justification**: which prior step / theorem / definition
     justifies it?
   - **Type / category check**: do the objects in this step have
     the structure the operation requires? (e.g., "the
     intersection of two compact sets is compact" needs the
     ambient space to be Hausdorff for compact sets to be
     closed).
   - **Quantifier scope**: what's universal, what's existential,
     in what order?
4. **Check for gap categories.**
   - **Missing case** ("WLOG …" that isn't actually WLOG).
   - **Quantifier swap** (`∃x ∀y` vs `∀y ∃x` — different
     statements).
   - **Implicit hypothesis** (the proof works only if the space
     is connected / second-countable / etc., but the hypothesis
     was dropped).
   - **Circular reasoning** (using what's being proved as a
     lemma, possibly several steps removed).
   - **Type confusion** (treating a function as its graph,
     a set as a class, an element as a subset).
   - **Citation hand-wave** ("by [Smith 2010]") where Smith's
     theorem doesn't actually apply to the situation.
   - **Unstated convergence / continuity / measurability**
     in analysis steps.
5. **Check edge cases.** Apply the proof to:
   - The trivial / empty case (n=0, the empty set, the trivial
     group, the zero module).
   - Boundary cases (where hypotheses become marginal).
   - Counterexamples to a slightly weaker claim — does the
     proof still work? If yes, the proof may prove too much.
6. **Verdict.**
   - **Correct as written**: pass.
   - **Correct, with minor gaps fillable**: list each gap and
     suggest the fix.
   - **Has a substantive gap**: point to the step; describe why
     the gap matters.
   - **Wrong**: identify the false step; ideally produce a
     counterexample to the claim *or* to the false step's
     auxiliary claim.

## Worked verification (compressed)

> Claim: every continuous function f: [0,1] → R is uniformly
> continuous.
>
> Assumptions: standard real analysis, ZFC; [0,1] with usual
> topology; R with usual metric.
>
> Step trace (sketch):
> 1. [0,1] is compact (Heine–Borel) — citation correct.
> 2. f continuous on compact metric space → uniform continuity.
>    Justification: standard theorem, e.g., Rudin
>    *Principles* 4.19. Proof: cover-and-Lebesgue-number
>    argument; type-checks (we have a metric space).
> 3. Conclusion follows.
>
> Gap analysis: none. Edge cases: f constant — trivially
> uniformly continuous. f(x) = x^n — uniform on [0,1] but not on
> R; consistent with the theorem requiring compact domain.
>
> Verdict: correct as written.

## Computer-verification interface

When the user is working in a proof assistant (Lean / Coq /
Isabelle / Agda), the agent's job shifts: instead of natural-
language verification, the agent checks the formal-statement
correspondence:

- Does the formal statement match the informal claim?
- Are the hypotheses faithful (no silent strengthening)?
- For partial / sorry'd proofs, name what each `sorry` would
  need to fill.

## Discipline rules

- **Find the gap, don't prove around it.** If a step is
  missing, name it; don't silently fill it (the user wanted to
  know if their proof is correct).
- **Distinguish gap from minor sloppiness.** Some gaps are
  notation, some are real. Tag severity.
- **Cite sources.** When invoking a textbook theorem, give
  the standard citation (Rudin / Hartshorne / Hatcher /
  Atiyah-Macdonald) so the user can check.
- **Refuse to bless without checking.** "Looks fine" is not
  a verification.

## Output

```
:::artifact
template: proof-verification
claim: "..."
assumptions: [...]
trace:
  - { step: 1, statement: "...", justification: "...", check: "ok" | "gap" | "wrong" }
  - ...
gaps: [...]
edge-cases-checked: [...]
verdict: "correct" | "correct-with-gaps" | "incorrect"
counterexample: "..." | null
:::
```

## Refusal

The agent will not:
- Pass a proof with substantive gaps without naming them.
- Fabricate the missing steps to make a flawed proof "work."
- Verify a proof that uses a theorem the agent cannot identify;
  it will mark the citation as needing verification.
