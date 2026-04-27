# UX Strategy (Designer)

## Purpose
A 1–2 page strategy document tying design decisions to the PM's locked
hypothesis. Produced Tuesday in parallel with eng-manager's feasibility
scoping. Names the **fidelity decision** for the cycle and the **question
that fidelity answers**.

## When to use
- Tuesday scoping, after PM hands the discovery one-pager.
- Any time the team is choosing between paper / wireframe / mock /
  coded prototype.
- When a feature spans multiple flows and information architecture
  matters.

## Sections

### 1. Problem statement
- What user problem are we solving? (pull from PM's discovery one-pager)
- For whom (named persona)?
- What is the current experience and its pain points?

### 2. User goals × business goals
- **User goals:** what does the user want to accomplish?
- **Business goals:** what does the business need (engagement,
  conversion, retention)?
- **Alignment / conflict.** Where do these align? Where do they collide?
  A design that resolves the collision honestly is more durable than
  one that papers over it.

### 3. Key scenarios (3–5)
For each scenario:
- User (persona name)
- Context (where, when, on what device, with what state)
- Task (what they're trying to accomplish)
- Success criteria (measurable: completed in N steps, under T seconds,
  with zero errors)

### 4. Design principles (3–5)
Principles that guide every decision in this design. Examples:
- **Progressive disclosure** — show the minimum, expose the rest on demand.
- **Error prevention before error recovery** — make the wrong action
  hard to take.
- **Continuity with prior product surface** — new flows match existing
  conventions unless we have a reason to break them.
Reference Nielsen heuristics where applicable.

### 5. Information architecture
- High-level structure: screens, navigation, content hierarchy.
- Key user flows — happy path **and** at least two edge cases.
- Where new content/screens slot into existing IA.

### 6. Fidelity decision (this is the load-bearing section)
- Pick one: **paper / wireframe / interactive mock / coded prototype**.
- Name the **discovery question** this fidelity answers. Examples:
  - paper → "Do users understand the conceptual flow?"
  - wireframe → "Is the IA legible without visual polish?"
  - interactive mock → "Does the click-by-click flow feel right?"
  - coded prototype → "Does the interaction feel right under real
    latency / data / errors?"
- Justify: **higher fidelity is not always better**. Higher fidelity
  costs more and biases users toward visual feedback over conceptual
  feedback. Match fidelity to the question, not to ambition.

### 7. Success metrics for the design
- Task completion rate (target %)
- Time on task (baseline + target)
- Error rate (baseline + target)
- Subjective satisfaction (CSAT / SUS / SUPR-Q)
- Tie at least one to the PRD's primary metric.

### 8. Risks & mitigations
- Usability risks (which heuristic is most at risk)
- Technical risks (where eng-manager's feasibility report flagged unknowns)
- Adoption risks (will the existing user base resist the change)
- Mitigation: what we'd build/ship/test to reduce each risk

### 9. Out of scope
- Named exclusions for this cycle. Deliberate scope on a UX strategy
  prevents Thursday's sprint from absorbing design ambition.

## Output (`:::artifact template: ux-strategy`)
- All 9 sections (concise, 1–2 pages)
- `producedBy: designer`, `consumedBy: pm`
- The fidelity decision and its discovery question are highlighted
- One-line "biggest concern" handed to PM end-of-day Tuesday
