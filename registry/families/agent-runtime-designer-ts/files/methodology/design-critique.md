# Design Critique Template

## Overview
Provide structured, actionable feedback on a design that engages
principles and user goals — not personal taste. The output gives
the designer a list of issues with severity, principle reference,
and a concrete next move.

## When to use
Trigger when the user shares a design (screen, flow, component,
mockup, prototype) and asks for review. For early ideation, use
ux-strategy.md. For prototyping decisions, use prototyping-guide.md.

## Method

### 1. Context (always ask first)

Before critiquing, get:
- What is the design for? (specific screen, flow, component,
  use-case)
- Stage: sketch / wireframe / hi-fi mock / interactive
  prototype.
- Audience: end-user demographic, device, environment.
- Constraints: brand system, accessibility requirements, dev
  capacity.
- The designer's question: "Is the hierarchy clear?" "Does the
  empty state work?" "Should I drop this filter?" — Critique
  drift happens when the critic answers a question the designer
  didn't ask.

### 2. What works (always lead with this)

2–3 things that are effective. Reference specific elements:
- "The empty-state illustration removes the dead screen and
  invites action via the primary CTA — clear next step."
- "Type scale is well-applied; H1 has enough weight contrast
  vs. body to lead the eye."
Skipping this section makes the critique feel adversarial and
undermines the designer's ability to repeat what's working.

### 3. Issues (the meat)

For each issue:
- **Description**: what is wrong, where, in what state.
- **Principle / heuristic**: tie to:
  - Nielsen's 10 heuristics (visibility, match, control,
    consistency, error prevention, recognition vs recall,
    flexibility, aesthetic minimalism, error recovery, help).
  - Fitts's law / Hick's law / Miller's law.
  - Accessibility (WCAG 2.2 — contrast, target size, keyboard,
    screen reader).
  - Brand system / design system rules.
  - User-research finding from prior testing.
  - "Personal preference" is not a principle — strike it.
- **Severity**:
  - **Critical**: blocks the user, breaks accessibility, breaks
    the system. Must fix before ship.
  - **Important**: degrades experience for many users; should
    fix this iteration.
  - **Polish**: minor; fix opportunistically.
- **Suggestion**: a concrete alternative, not just "improve."

### 4. Open questions

What's unclear from the artifact alone?
- Behavior: "What happens when the list has 0 items?"
- States: hover, focus, disabled, loading, error, empty.
- Edge cases: long content, missing avatar, slow network.
- Responsive / breakpoints: how does this adapt?
- Localization: longer translations, RTL.
- Permissions: what changes for read-only users?

Open questions reveal hidden requirements as much as they probe
the design.

### 5. Accessibility quick-pass

Even when not the main focus, every critique covers:
- Color contrast (text ≥4.5:1, UI ≥3:1).
- Touch target size (≥44×44pt iOS / 48×48dp Android).
- Keyboard navigability (logical focus order, visible focus
  state).
- Non-color signal for status (don't rely on color alone for
  error / success).
- Alt text / descriptive labels for icons.
- Motion: respect reduced-motion preference.

### 6. Summary

- Biggest risk: what's most likely to fail in user testing?
- Biggest opportunity: where could a small change have outsize
  impact?
- Confidence in the design overall: where you'd ship as-is, where
  you'd want another iteration.

## Discipline rules

- **Critique the work, not the worker.** "This screen confuses
  the hierarchy" not "you got the hierarchy wrong."
- **Specific over abstract.** "The CTA color matches the
  secondary button, breaking visual priority — try the brand
  primary at 100% saturation" beats "the CTA isn't prominent."
- **Suggestion not prescription.** Offer 1–2 concrete
  alternatives; don't dictate the solution. The designer owns
  the call.
- **Anchor to data when possible.** "User research showed people
  miss filters in the right rail" beats "filters in the right
  rail are usually missed."
- **Cap the issue list.** 5–7 issues per critique. Beyond that,
  the designer can't act.

## Output

```
:::artifact
template: design-critique
context:
  artifact: "..."
  stage: "hi-fi mock"
  designer-question: "Is the hierarchy clear?"
what-works: [...]
issues:
  - { id: I1, where: "...", description: "...", principle: "Nielsen #4 consistency", severity: "Important", suggestion: "..." }
  - ...
open-questions: [...]
accessibility-flags: [...]
summary:
  biggest-risk: "..."
  biggest-opportunity: "..."
:::
```

## Refusal

- The agent will not critique without context — gather first.
- The agent will not give a "looks good" review; if no real
  issues, name what makes it work and offer one stretch
  improvement.
- The agent will not let "personal preference" pass as a
  critique.
