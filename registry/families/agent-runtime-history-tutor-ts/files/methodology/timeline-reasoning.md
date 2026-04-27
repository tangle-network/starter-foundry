# Timeline Reasoning Template

## Purpose
Help the learner reason about causation, periodization, and change
over time — moving past chronology to historical argument. The output
is a structured reasoning exercise, not a dated bullet list.

## When to use
Trigger when the user asks "why did X happen," "what caused Y," "is
the standard periodization right," or wants to test a counterfactual.
For source-level analysis, use source-analysis.md.

## The three modes

History students need to distinguish:

- **Chronology**: what happened, in order. The skeleton.
- **Periodization**: how to chunk the chronology into meaningful
  periods. The interpretation.
- **Causation**: why one thing led to another. The argument.

Most weak history writing collapses the three. Strong writing
keeps them distinct.

## Method

1. **Define the period** under analysis.
   - Boundaries: start date, end date, and the *reason* for each.
     "1789–1815" rests on French Revolution + Napoleon's defeat as
     bracket events; an alternative "1750–1850" frames the same
     era as the rise of industrial Britain.
   - Boundary defensibility: every periodization is an argument.
     Name what the boundaries privilege and what they obscure.
2. **Inventory key events** with explicit roles.
   - **Trigger**: the event that immediately set off the
     transition.
   - **Cause**: a condition without which the trigger would not
     have produced its effect.
   - **Consequence**: what the event produced downstream.
   - **Coincidence**: contemporaneous but not causally entangled.
   Naming role explicitly prevents post-hoc-ergo-propter-hoc.
3. **Causation analysis.** Apply the standard distinctions:
   - **Proximate vs. structural**: assassination of Franz
     Ferdinand vs. alliance system. Both matter; conflating them
     hides the argument.
   - **Necessary vs. sufficient**: a necessary cause must be
     present for the effect; a sufficient cause guarantees it
     alone. Most historical causes are necessary-but-not-
     sufficient.
   - **Material vs. ideological vs. contingent**: economic
     conditions, ideas, and individual choices each contribute;
     historiography fights over weights.
4. **Counterfactual reasoning.** Useful as a probe, not as
   proof.
   - Pick a single causal node and vary it.
   - Hold other conditions fixed.
   - Ask: would the proximate effect still occur? Would the
     structural conditions still produce a similar outcome via
     a different trigger?
   - Counterfactuals expose which causes are doing the most work.
5. **Periodization alternatives.** Re-cut the same chronology
   under a different lens.
   - Political vs. social vs. economic vs. cultural cuts often
     yield different boundaries.
   - Each cut centers different actors. "Reformation 1517–1648"
     centers theology; "Confessionalization 1550–1650" centers
     state-formation; "Print revolution 1450–1650" centers
     technology.
   - The pedagogical move: hold a fixed event constant, ask the
     learner to re-frame it under three different periodizations.
6. **Argument shape.** The output should sustain a thesis. "X
   happened because of Y, not Z, because of evidence A, B, C —
   though Z mattered for D." Strong history writing names rivals
   and explains why they're insufficient.

## Worked example

> Question: why did the Roman Republic fall?
>
> Period: 133 BCE (Tiberius Gracchus) – 27 BCE (Augustus).
> Boundary defensibility: 133 chosen for the breakdown of senatorial
> consensus on land reform; 27 chosen for the formal end-state.
> Alternative: 49 BCE (Caesar's Rubicon) – 27 BCE; alternative
> emphasizes the civil-war phase, brackets out the structural
> precursors.
>
> Key events:
> - 133 trigger / structural: Gracchan reforms expose senate's
>   inability to manage agrarian crisis without violence.
> - 88, 82, 49 triggers: Sulla, Marius, Caesar — pattern of
>   commanders using armies as personal political tools.
> - structural cause: army professionalization (Marian reforms,
>   ~107 BCE) shifted soldier loyalty from state to commander.
> - structural cause: empire size outgrew republican
>   institutional capacity (governor wealth + clientele).
>
> Counterfactual: had Caesar been killed before crossing the
> Rubicon, would the Republic survive? Probably not — the
> structural pressures (loyal armies, wealthy proconsuls) would
> produce a similar collapse via another commander. The
> counterfactual exposes Caesar as proximate, not structural.
>
> Alternative periodization: 200 BCE – 14 CE. Centers the gradual
> imperial transformation; brackets out the dramatic civil-war
> phase as one of several long-running pressures.
>
> Thesis: Republican collapse was structurally over-determined
> after Marian army reforms; specific assassinations, civil
> wars, and Augustus' settlement determined the *shape* but not
> the *fact* of the transition.

## Discipline rules

- **Don't confuse correlation with causation.** "X happened then
  Y happened" is chronology, not causation.
- **Don't fall for great-man framing alone.** Individual choice
  matters but rarely sufficient without structural conditions.
- **Don't fall for structural framing alone.** Structural
  determinism flattens contingent decisions and individual agency.
- **Periodization is an argument.** Defend the boundaries; don't
  borrow them unexamined from the textbook.

## Output block

Wrap in `:::artifact` with `template: timeline-reasoning`. Include
period bounds with defense, named events with roles, causation
analysis, counterfactual probe, and at least one alternative
periodization.

## Pedagogical scaffolding

When the user is a learner, ask them to attempt periodization first.
Their boundary choice reveals what they think the period is *about*.
Critique the boundaries before adding facts.
