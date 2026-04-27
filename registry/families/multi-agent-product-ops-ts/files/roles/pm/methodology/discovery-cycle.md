# Discovery Cycle (PM)

## Purpose
Reduce risk before building by testing the riskiest assumption with real users.
A discovery cycle ends with a decision: proceed, pivot, or kill — backed by
evidence, not opinion.

## When to use
- Before locking any PRD that costs more than one sprint.
- When the riskiest assumption can't be answered from existing data.
- When CS surfaces a recurring theme that may or may not generalize.

## The five phases

### 1. Frame
- What is the **decision** we need to make?
- What is the **riskiest assumption** behind that decision? "Riskiest" =
  highest probability of being wrong × highest cost if wrong.
- What would we do **differently** if we knew the answer? If the answer
  doesn't change the decision, the cycle is theater — kill it.
- Write this on a single page. If it doesn't fit, the frame isn't sharp.

### 2. Design
- **Method.** Match method to question:
  - "Do users want this at all?" → 5–8 problem interviews
  - "Will users pay for this?" → fake-door test or pre-sale landing
  - "Can users complete the flow?" → prototype usability test
  - "Will users return?" → cohort-retention experiment in production
- **Sample.** Define the customer segment precisely. 5 of the right segment
  beats 50 of the wrong one.
- **Questions.** Open-ended, behavior-focused, no leading. Bad: "Do you
  hate the current export experience?" Good: "Walk me through the last
  time you exported data."
- **Falsification.** Write the result that would falsify your hypothesis
  **before** you collect data. If no result would change your mind, you
  are confirming, not discovering.

### 3. Execute
- Run the research. **Record observations, not interpretations.**
- Capture verbatim quotes, behaviors, emotional reactions.
- Tag each observation with the assumption it touches.
- If you find yourself summarizing during the interview, you're rushing —
  slow down and ask "tell me more about that."

### 4. Analyze
- What patterns emerged across observations? An n=1 surprise is anecdote;
  an n=3 pattern in a sample of 6 is signal.
- What did we learn about the assumption — confirmed, falsified, or still
  ambiguous?
- What new questions surfaced? These feed the next cycle.
- Resist the urge to bundle multiple findings into one PRD. Cycles are
  cheap; over-loaded PRDs are expensive.

### 5. Decide
- Based on the evidence, do we **proceed, pivot, or kill?**
- If proceed: hand to designer + eng-manager Tuesday with the discovery
  one-pager (`:::artifact template: discovery-cycle`).
- If pivot: rewrite the riskiest assumption and run another cycle.
- If kill: write the post-mortem so the team learns. Killed cycles are
  the cheapest learning the team can buy.

## Output (`:::artifact template: discovery-cycle`)
- Decision being made
- Riskiest assumption
- Method, sample, falsification criterion (set before data collection)
- Observations (verbatim where possible)
- Patterns
- Decision: proceed / pivot / kill
- Next riskiest assumption (feeds next cycle)

## Cadence rules
- One cycle = at most 2 weeks. Longer cycles indicate over-scoping.
- Run cycles **in parallel with current build** — never sequentially. The
  team should always have one cycle in discovery and one in delivery.
- Bring the output to **Monday discovery sync** for team alignment before
  handing to designer + eng-manager Tuesday.
