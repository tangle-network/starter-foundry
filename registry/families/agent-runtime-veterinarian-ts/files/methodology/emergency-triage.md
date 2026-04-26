---
capability: emergency-triage
status: active
source: hand-authored, ASPCA APCC + general veterinary emergency framing (reference, no endorsement)
retrieved: 2026-04-25
load-bearing: true
---

# Emergency Triage Recognition Checklist

**Load-bearing template.** Lives are downstream of this content.
Speed matters more than completeness. When any trigger below fires,
emit `:::escalation` immediately with the unambiguous "go to the
nearest emergency vet now" message and, for toxin ingestion, the
ASPCA APCC number.

> **ASPCA Animal Poison Control Center: 888-426-4435** (paid
> consultation, 24/7) — call this *and* proceed to the nearest
> emergency vet. Do not wait on hold to leave the house.

## When to use

The moment any trigger fires. This template overrides every other
mode — even mid-conversation, even mid-husbandry-packet, even if the
user only asked a casual question.

## Recognition by system

### Respiratory — minutes matter

- **Cyanosis** (blue / gray / muddy gum or tongue color)
- **Paradoxical breathing** (chest and abdomen moving in opposite
  directions on inhale)
- **Open-mouth breathing in a cat** at rest — never normal, always
  emergency
- **Panting at rest in a cat** — cats do not pant like dogs; this
  is significant
- **Choking, audible stridor, inability to swallow saliva**

### Circulatory — minutes matter

- **Pale, white, or muddy gums** (lift the lip — gums should be pink)
- **Capillary refill time** longer than ~2 seconds (press on the gum,
  count how long it takes the color to return)
- **Collapse, weakness, inability to stand**
- **Cold extremities** in a previously normal animal

### Gastrointestinal — bloat is minutes-matter

- **Bloat / GDV** (suspected gastric dilatation-volvulus) — distended
  abdomen, **repeated unproductive retching** (the dog tries to vomit
  and nothing comes up), restlessness, hypersalivation, collapse.
  Large / deep-chested breeds (Great Dane, Standard Poodle, Weimaraner,
  GSD, etc.) at highest risk. **GDV is a surgical emergency. Go now.**
- **Hematemesis** (vomiting blood — frank red or coffee-ground)
- **Hematochezia / melena** (blood in stool, or black tarry stool) in
  large volume or with weakness
- **Repeated vomiting** more than 2-3 times in a few hours, or in a
  puppy / kitten / geriatric / diabetic / Addisonian animal, or paired
  with lethargy

### Urinary — male cat unable to urinate is an emergency

- **Male cat straining to urinate, vocalizing in the box, no urine
  produced** — feline urethral obstruction, fatal within 24-72 hours
  if not relieved. Go to ER vet now.
- **Inability to urinate** in any animal
- **Frank blood in urine** with weakness or vocalization

### Neurological — same-day at minimum

- **Active seizure** (call from the car if needed; do not put your
  hand near the mouth)
- **Cluster seizures** (more than one in 24 hours) or **status
  epilepticus** (single seizure longer than ~5 minutes)
- **Unresponsiveness, severe ataxia (drunken gait), circling, head
  tilt of new onset**
- **Sudden blindness**

### Trauma — always evaluate

- Any **HBC** (hit by car) — even an animal that "seems fine"
  afterward; internal injuries (diaphragmatic hernia, pulmonary
  contusion, ruptured bladder) can be silent for hours
- Falls **greater than ~2× the animal's body height**
- **Bite wounds** from a larger animal — puncture wounds always
  injure deeper than they appear; infection risk is high
- **Suspected fracture** (non-weight-bearing limb)

### Toxin — call ASPCA APCC and go

ASPCA Animal Poison Control Center: **888-426-4435** (paid, 24/7).
Call from the car. The following are emergency until the APCC
toxicologist tells you otherwise:

- **Xylitol** in a dog — *any* quantity (sugar-free gum, peanut
  butter, baked goods, dental products); causes profound
  hypoglycemia and acute liver failure
- **Chocolate** in a dog — more than ~2 g/kg (the darker the
  chocolate, the smaller the threshold; baker's chocolate is far
  worse than milk chocolate)
- **Lily** in a cat — *any part, any quantity* of true lilies
  (Lilium spp.) and daylilies (Hemerocallis spp.); causes acute
  kidney injury. Even pollen brushed off the fur during grooming
  has caused fatal toxicity.
- **Grape / raisin / currant** in a dog — *any quantity*; idiopathic
  acute kidney injury
- **Ibuprofen, naproxen, acetaminophen, aspirin** — all toxic to
  pets; acetaminophen is rapidly fatal in cats
- **Rodenticides, antifreeze (ethylene glycol), pesticides,
  recreational drugs (THC, opioids, stimulants), heavy metals**
- **Onion / garlic** in dogs and cats — hemolytic anemia (cats
  far more sensitive than dogs)

Do not induce vomiting unless the APCC toxicologist or an emergency
DVM has explicitly told the user to do so for that specific
substance. Some toxins (caustics, hydrocarbons) cause more damage on
the way up.

## Escalation script

Every fired trigger emits the same `:::escalation` shape:

- The unambiguous next action: "Go to the nearest emergency vet
  now."
- For toxin: "Call ASPCA Animal Poison Control 888-426-4435 from
  the car (paid consultation) and go to the nearest emergency vet."
- For reportable disease (rabies suspected, etc.): "Contact a
  state-licensed DVM today; they have a legal duty to report."
- No diagnosis. No reassurance ("it's probably nothing"). No
  rationalization ("you could wait until morning"). No.

## What the agent will NOT do, ever, in this mode

- Diagnose the cause
- Recommend an at-home intervention (Benadryl, hydrogen peroxide,
  activated charcoal, "wait and see") without an APCC or emergency
  DVM directing it for that specific substance and animal
- Estimate dosing for any intervention
- Guess at survival odds
- Talk the user out of going to the ER

## Output discipline

Always emit `:::escalation` first, before any explanation. The
escalation block is the deliverable; explanation comes after, only
if the user asks, and never delays the escalation.
