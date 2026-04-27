# Design Critique (Designer)

## Purpose
Provide structured, actionable feedback on a flow, screen, or component.
Critique is grounded in heuristics and the PM's locked PRD — not personal
preference, not visual taste.

## When to use
- Friday review of shipped work against the locked UX strategy.
- Any time a teammate hands you a design and asks "is this good?"
- Pre-build, against eng-manager's prototype, when feasibility is asking
  "will users tolerate this trade-off?"

## Sections

### 1. Context
- What is being critiqued? (screen, flow, component, prototype state)
- What stage? (paper, wireframe, mock, coded prototype, shipped)
- What **question** does the designer or PM want answered? Without a
  question, critique drifts to taste.
- Reference the PRD's primary metric — every critique points back at
  whether the design moves it.

### 2. What works (2–3 items)
- Name specific elements or interactions that succeed.
- Tie each to a heuristic or established pattern (e.g. "the primary
  action is consistent with platform convention — least-astonishment").

### 3. What could be improved (prioritized)
- For each issue:
  1. **Describe** the problem concretely. Avoid "feels off."
  2. **Explain** why it matters — reference a heuristic, the PRD's
     primary metric, or a known accessibility pattern.
  3. **Suggest** a concrete improvement. "Move the CTA above the fold"
     beats "improve hierarchy."
- Tag each item:
  - **critical** — blocks the user job or causes accessibility failure
  - **important** — costs measurable percentage of the primary metric
  - **nice-to-have** — improves polish, no direct metric impact

### 4. Heuristic checklist (Nielsen's 10, abbreviated)
Run through each. Note any violation:

- Visibility of system status
- Match between system and the real world
- User control and freedom (undo, exit, back)
- Consistency and standards (platform conventions)
- Error prevention
- Recognition over recall
- Flexibility and efficiency of use
- Aesthetic and minimalist design
- Help users recognize, diagnose, recover from errors
- Help and documentation

### 5. Accessibility check
- Color contrast ≥ 4.5:1 for text, 3:1 for large text and UI.
- Every interactive element keyboard-reachable, with visible focus.
- Every non-text element has a meaningful alt or aria-label.
- No information conveyed by color alone.
- Motion respects `prefers-reduced-motion`.

### 6. Open questions
- What is unclear or needs more information from PM, eng-manager, or
  user research?
- What assumptions should be validated before lock?

### 7. Summary
- Biggest **risk** if shipped as-is (one sentence).
- Biggest **opportunity** if iterated (one sentence).
- Recommendation: ship / iterate / re-scope.

## Output (`:::artifact template: design-critique`)
- All 7 sections, with `critical` items at the top
- `producedBy: designer`
- Tied to the PRD ID being critiqued
- A single line at the end: "ship / iterate / re-scope" with the reason
