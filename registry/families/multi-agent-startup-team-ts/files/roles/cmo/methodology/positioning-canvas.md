---
capability: positioning-canvas
status: active
source: hand-authored, synthesized from Moore (Crossing the Chasm) + Dunford (Obviously Awesome) + Maurya (Lean Canvas)
retrieved: 2026-04-26
---

# Positioning Canvas (CMO-led)

The methodology for any positioning conversation. Positioning is
not a tagline, a brand voice, or a manifesto. It's a deliberate
choice about **who you are best for, against what alternatives,
doing what job**. Every other marketing decision flows from it;
getting it wrong costs more than getting it late.

## When to use

- Founder or operator says "I don't know how to describe what we
  do."
- Conversion is bad and the suspicion is messaging, not product.
- Sales calls require 20 minutes of context-setting before
  discovery.
- The team disagrees on who the customer is.
- A new competitor enters and the relative frame just shifted.
- Pricing change proposed — positioning often changes with price.

## Multi-role contributions

| Slot | Contributor |
|---|---|
| Beachhead segment, alternatives, unique value, whole-product gaps | CMO |
| Strategic fit ("does this segment match the company's bet") | CEO (handoff if pivot-shaped) |
| Pricing implications, margin under positioning | CFO Advisor (handoff if pricing changes) |
| Capability gaps the positioning exposes (latency, integrations, regional coverage) | CTO (handoff if positioning makes a customer-visible promise the product cannot keep) |

CMO drafts steps 1–5 alone. Hand off **after** step 5 if any of:

- Positioning implies a pivot or new market → `:::handoff to: ceo`.
- Positioning includes a price change → `:::handoff to: cfo-advisor`.
- Positioning promises a capability the product does not currently
  ship → `:::handoff to: cto` to confirm feasibility before shipping
  the message.

## Method

**1. Name the alternatives.** Not the competitors — the
*alternatives*. What does the user do today if your product
doesn't exist? Spreadsheets? A different vendor? A consultant?
Nothing? The alternative defines the frame the user evaluates you
in. Get this wrong and every downstream message lands in the wrong
category.

**2. Pick the beachhead segment.** Crossing-the-Chasm rule: choose
one segment narrow enough that the segment members talk to each
other, share vocabulary, and can be reached by the same channel.
"B2B SaaS" is not a segment. "Series A vertical SaaS founders
selling to dental practices" is a segment. Resist the urge to
keep options open — the beachhead is supposed to be small.

**3. Identify the unique value.** What can you do that the
alternatives cannot, that *this segment* cares about? Not features
— outcomes the segment values that the alternatives structurally
can't produce. If the alternatives can produce it with a quarter
of effort, it's not unique value, it's a feature gap that will
close.

**4. Describe the whole product.** Moore's whole-product gap: the
product the segment actually needs (training, integrations,
support, references, a community) versus the product you ship.
Name the gap. Decide who fills it (you, a partner, the customer
themselves) and how that's funded.

**5. Map the trade-off.** Positioning that wins one segment loses
others. Name the three segments this positioning explicitly does
NOT serve and why losing them is acceptable. If you can't name
them, the positioning is too broad and will land nowhere.

## Output

```
:::artifact
template: positioning-canvas
date: <YYYY-MM-DD>
contributors: [cmo, ceo?, cfo-advisor?, cto?]
segment: <beachhead segment>
alternatives: [<alt-1>, <alt-2>, <alt-3>]
unique-value: <one sentence, segment-specific outcome>
whole-product-gaps: [<gap-1>, <gap-2>]
gap-owners: { <gap-1>: us | partner | customer, ... }
not-for: [<segment-1>, <segment-2>, <segment-3>]
positioning-statement: |
  For [segment] who [trigger], [product] is the [category] that
  [unique value], unlike [alternative], we [proof].
:::
```

Follow with a `:::analysis` block naming the two highest-risk
assumptions in the canvas — the ones that, if wrong, invalidate
everything downstream. If those assumptions live in another role's
domain (CFO Advisor on price, CTO on capability), name the role.

## Discipline rules

- Refuse to write a positioning statement before steps 1-5 are
  filled in. Statements written first are aspirational; statements
  written last are operational.
- Do not collapse multiple segments into a "primary + secondary"
  structure on the first pass. Force a single beachhead.
  Secondaries come after the beachhead works.
- "Innovative", "best-in-class", "next-generation" are banned. They
  describe nothing and commit to nothing.
- If the user can't name what their customer would do without them,
  stop the canvas and ask for the customer interview data first.
- If the positioning makes a capability promise that requires CTO
  confirmation, hand off **before** finalizing the artifact. A
  positioning the product cannot deliver is a brand wound waiting.

## Source

Geoffrey Moore, *Crossing the Chasm* (beachhead segment, whole
product). April Dunford, *Obviously Awesome* (positioning as
deliberate choice, alternatives frame). Ash Maurya, *Running Lean*
(Lean Canvas problem-solution fit). Multi-role handoff adapted for
the startup-team runtime.
