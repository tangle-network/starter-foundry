# veterinary-reference

Veterinary-reference agent bundle. **Not a licensed veterinarian.**
Provides general-information packets on husbandry, vaccination
*frameworks* (not schedules), behavior framing, preventive-care
education, and emergency-recognition checklists. Operates inside a
Tangle sandbox; LLM calls go through `router.tangle.tools`.

> If your animal is in distress, stop reading this and call the
> **ASPCA Animal Poison Control Center: 888-426-4435** (paid
> consultation, 24/7) and proceed to the nearest emergency vet.

## What this bundle is

An agent's filesystem: a system prompt + husbandry / vaccination /
emergency-triage templates + a Cloudflare Worker shell + Tangle Sandbox
SDK. The agent claims no veterinary-client-patient relationship (VCPR)
and never replaces a state-licensed DVM. The escalation path is
load-bearing — by design it fires often.

## Regulatory positioning

- **No VCPR.** The veterinary-client-patient relationship belongs to
  a state-licensed DVM who has examined the animal in person. This
  bundle never claims one.
- **No diagnosis. No prescription. No treatment plan.** Including
  OTC dosing — guessing OTC doses for animals is routinely fatal.
- **AVMA framing only.** Output is consistent with the AVMA's
  Principles of Veterinary Medical Ethics (general-information role).
  AVMA does not endorse this bundle; citation is reference-only.
- **Reportable-disease handoff.** Rabies, brucellosis, FMD and any
  state- or USDA-reportable condition is an immediate `:::escalation`
  to a licensed DVM (the legal reporting duty is theirs).
- **Regulated procedures left alone.** Declaw, devocalization, tail
  dock, ear crop, debark — banned or restricted in many jurisdictions.
  The bundle does not recommend, plan, or coach.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `notLicensedVet: true`, `regulatoryDisclaimer: true`,
   `allowedDomains: [api.tangle.tools, avma.org, fda.gov/cvm]`).
3. Agent operates in reference mode by default (husbandry + framing).
4. Any emergency / Rx / reportable / regulated / toxin trigger fires
   `templates/emergency-triage.md` and emits a `:::escalation` block
   carrying the unambiguous "go to ER vet now" message and the ASPCA
   APCC number where toxin is involved.

## Domain capabilities

- `husbandry-reference` — diet category by species/life-stage
  (AAFCO-statement framing), enrichment per species, exercise by
  life-stage, BCS 1-9 weight framing, red-flag-change checklist.
  Methodology in `templates/husbandry-reference.md`.
- `vaccination-framework` — core vs non-core framing per AAHA
  (canine) and AAFP (feline); how to read the licensed DVM's
  schedule; why rabies is state-mandated; why titer testing exists.
  **Does not produce a schedule.**
- `emergency-triage` — recognition checklist organized by system
  (respiratory, circulatory, GI, urinary, neuro, trauma, toxin) with
  unambiguous escalation messaging. The load-bearing template.
- `regulated-disclaimer` — AVMA-aligned no-VCPR framing; fires on
  every clinical-territory question.

## Out-of-scope by design

- Diagnosis of any kind, including informal ("sounds like …")
- Prescription, including OTC dosing (Benadryl, aspirin, Pepto-Bismol)
- Anesthesia / sedation planning
- Vaccine schedules (frameworks only — schedule is the DVM's call)
- Recommending skipping or delaying any vaccine the DVM scheduled
- Regulated procedures (declaw, devocal, dock, crop, debark)
- Reportable-disease handling (legally the DVM's duty)

## Critical numbers

- **ASPCA Animal Poison Control Center**: 888-426-4435 (paid, 24/7)
- **Pet Poison Helpline** (alternate, paid, 24/7): 855-764-7661
- **Nearest emergency / 24-hour vet**: keep on the user's fridge

## Extension points

- `system-prompt.md` — adjust role / refusal triggers / output blocks.
  Re-run `prompt-frontmatter-valid` after edits.
- `templates/emergency-triage.md` — the load-bearing template. Any
  edit here is a high-stakes change; review against current AVMA /
  ASPCA APCC guidance before promoting.
- `templates/vaccination-framework.md` — refresh references when AAHA
  or AAFP publishes a new edition; bump `retrieved` date.
- `defaults.allowedDomains` — additional outbound URLs the bundle is
  permitted to reach. Anything outside this list is sandbox-blocked.
- `defaults.poisonControl` — override regional poison-control numbers
  for non-US deployments.
