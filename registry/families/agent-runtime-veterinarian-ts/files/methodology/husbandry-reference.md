---
capability: husbandry-reference
status: active
source: hand-authored, AAFCO + AAHA + AAFP framing (reference, no endorsement)
retrieved: 2026-04-25
---

# Husbandry Reference

General-information framing for diet, enrichment, exercise, and weight
management. Categories and frameworks only — never specific brand
recommendations, never specific quantities, never substitutes for the
licensed DVM's care plan.

## When to use

The default mode for any non-clinical husbandry question. Switch out
if the user's question crosses into clinical territory (anything that
would require a diagnosis, a prescription, or a treatment plan) — load
`emergency-triage.md` instead.

## Diet — category, not brand

Frame diet by **species + life-stage** and the AAFCO nutritional
adequacy statement on the label. Categories:

- **Puppy / kitten** — growth formulas; large-breed puppy distinct
  from small/medium because of skeletal-growth-rate sensitivity
- **Adult maintenance** — most common; AAFCO-adequate for the species
- **Senior** — manufacturer-defined, no AAFCO life-stage; lifestyle
  support, not therapeutic
- **Therapeutic / prescription diets** — Rx-only, DVM-prescribed,
  NOT in scope here
- **Reproductive (gestation / lactation)** — escalate to DVM

Refusal edge: when the user asks "what should I feed my [species]?"
the answer is "an AAFCO-complete-and-balanced [life-stage] formula
for [species]; ask your DVM for the specific brand that fits your
animal's body condition, allergies, and any preventive concerns."
Never recommend a specific brand. Never recommend raw, BARF, or
home-cooked without a board-certified veterinary nutritionist
(DACVN) supervising — escalate.

## Enrichment — species-typical

**Cats** need three pillars:

- **Vertical space** — shelves, cat trees, window perches; cats
  resolve conflict by altitude, not distance
- **Scratching substrate** — both vertical and horizontal options;
  scratching is welfare, not misbehavior
- **Hunt-style feeders** — puzzle feeders, food-foraging toys; cats
  evolved on 8-10 small prey-meals per day, not two bowl-meals

**Dogs** need three pillars:

- **Physical exercise** — life-stage and breed appropriate
- **Mental work** — training sessions, scent work, puzzle feeders;
  10 minutes of nose-work fatigues a dog more than 30 minutes of
  fetch
- **Species-typical work** — herding-breed needs differ from
  scent-hound needs differ from companion-breed needs; match to
  the animal in front of you, not the breed average

## Exercise targets — by life-stage

Frame as targets the DVM can confirm or adjust:

- **Puppy** — short, frequent, low-impact; growth-plate-aware
  (no forced running on hard surfaces, no repetitive jumping);
  ask the DVM about breed-specific growth-plate closure
- **Adult dog** — daily on-leash walking plus species-typical work;
  highly variable by breed
- **Senior dog** — maintain activity at lower intensity; watch for
  orthopedic signs and escalate
- **Cat (any age)** — 10-15 minutes of interactive play, twice
  daily, ideally pre-feeding to mimic hunt-eat-groom-sleep cycle

## Weight management — BCS 1-9

Use the 9-point Body Condition Score as the reference scale (BCS 4-5
is ideal for most species). The bundle does NOT compute target weight
— that's the DVM's call given conformation, breed, and condition. The
bundle DOES describe what each BCS visual landmark means so the user
can communicate accurately with their DVM.

## Red-flag changes — escalate, do not interpret

When the user reports any of these, emit `:::escalation` and load
`emergency-triage.md`. Do not interpret the cause.

- Sudden **polyuria / polydipsia** (drinking and urinating much more)
- Unintended **weight loss** of more than ~10% body weight
- Sudden **hiding** or change in social behavior (especially cats —
  cats hide pain)
- Change in **litter-box habits** (going outside the box, straining,
  vocalizing while urinating — male cat straining is an emergency)
- Change in **appetite** lasting more than 24-48 hours
- Coat changes — sudden, patchy, or pruritic

Each of these has dozens of possible causes, several of them serious.
The agent's job is to surface the change clearly, never to guess the
diagnosis.

## Output discipline

Husbandry packets emit a `:::artifact` block with the reference
content (species, life-stage, the framing categories, what to ask the
DVM). Red-flag changes always trigger `:::escalation` even if the
user only asked a husbandry question — the trigger overrides the
default mode.
