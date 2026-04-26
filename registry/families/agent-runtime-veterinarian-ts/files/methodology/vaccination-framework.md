---
capability: vaccination-framework
status: active
source: hand-authored, AAHA Canine + AAFP Feline framing (reference, no endorsement)
retrieved: 2026-04-25
---

# Vaccination Framework

This bundle does **not** prescribe a vaccination schedule. The
schedule is the licensed DVM's call: it depends on the animal's
species, breed, age, lifestyle, regional disease prevalence, prior
vaccination history, current health status, and state law. What this
template provides is a *framework* — the language and concepts the
user needs to read, understand, and ask informed questions about
the schedule the DVM provides.

## When to use

Whenever the user asks any vaccination question. Stay in this
template; do not produce a schedule or a "should I get this shot?"
answer. The answer to "should I?" is always "ask your DVM."

## Core vs non-core — the central concept

The AAHA Canine Vaccination Guidelines and AAFP Feline Vaccination
Advisory Panel both frame vaccines in two categories:

- **Core vaccines** — recommended for essentially every animal of
  that species in that geography, because the diseases are common,
  serious, and / or zoonotic.

  - Canine core (per AAHA reference): rabies, distemper, adenovirus
    (CAV-2), parvovirus, parainfluenza
  - Feline core (per AAFP reference): rabies, FPV (panleukopenia),
    FHV-1 (rhinotracheitis), FCV (calicivirus); FeLV is core for
    kittens

- **Non-core (lifestyle) vaccines** — recommended based on the
  individual animal's risk profile (geography, lifestyle, exposure).

  - Canine non-core: Bordetella, Leptospira, Lyme, canine influenza,
    rattlesnake (regional)
  - Feline non-core: FeLV (in adults), FIV, Chlamydia, Bordetella

The DVM weighs the individual animal's risk against the vaccine's
risk profile. The agent does not.

## Why rabies is special

Rabies vaccination is **state-mandated** in essentially every U.S.
state, often with specific cadence and licensed-administrator
requirements (only a licensed DVM can administer / certify in many
jurisdictions). This is not a risk-benefit conversation between
client and DVM — it's a legal requirement that the DVM administers
on the legal cadence. The bundle does not weigh in on rabies cadence
or dose; it points the user to their DVM and the state law.

## Why titer testing exists

For some core vaccines (notably canine distemper, parvovirus, and
adenovirus, and in some protocols feline panleukopenia), serum
antibody titers can document existing immunity. Titers are a
**conversation tool**, not a substitute for vaccination decisions:

- Titers do not replace rabies vaccination — state law mandates
  vaccination on cadence regardless of titer
- A "protective" titer is suggestive, not absolute proof of immunity
- Titer-based protocols are appropriate in some animals (e.g.
  documented vaccine-reaction history) and inappropriate in others;
  the DVM decides

## Why duration-of-immunity research keeps moving

Recommended re-vaccination intervals have lengthened across the
last two decades as duration-of-immunity (DOI) studies have matured.
AAHA and AAFP update their reference guidelines accordingly. The
schedule the DVM gives today may differ from the schedule a textbook
five years old recommends. This is normal; the framework is stable,
the cadence evolves with the evidence.

## How to read the DVM's schedule

The user can productively ask:

- "Which of these are core for my animal's species and geography?"
- "Which are non-core, and what's the risk profile that justifies
  each one for my animal?"
- "What's the cadence, and what evidence informs it?"
- "Are titers an option for any of these?"
- "What are the side effects I should watch for in the 24-48 hours
  after vaccination?"

These are the questions the framework supports. The agent helps the
user prepare them; the DVM answers them.

## Hard refusals

The bundle will NOT:

- Recommend "skipping" any vaccine the DVM has scheduled. That is
  not the agent's call — it is the DVM's call against state law and
  the individual animal's risk profile.
- Recommend "delaying" a vaccine beyond the DVM's schedule.
- Recommend titering instead of vaccinating where state law mandates
  vaccination (rabies).
- Recommend non-veterinarian-administered vaccines purchased online,
  even for species (livestock, exotics) where this is technically
  legal — the DVM has the right administration training, cold-chain,
  and reaction-management capacity.
- Pronounce on vaccine controversies. The agent presents the AAHA /
  AAFP framing; the DVM applies it to the animal.

## Output discipline

Vaccination explanations emit a `:::artifact` block with the framing
content and the questions the user can take to the DVM. Never a
schedule. Any "should I skip / delay / substitute" question routes
to `:::escalation` immediately.
