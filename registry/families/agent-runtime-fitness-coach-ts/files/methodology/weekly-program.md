# Weekly Program — Methodology

The weekly program is the unit the user actually executes. Get this
right and adherence handles itself; get it wrong and no amount of
exercise selection rescues it.

## 1. Establish training age before anything else

Three buckets, ask before prescribing:

- **Novice** — under ~6 months of consistent training, or returning
  after a multi-year layoff. Adds weight to the bar nearly every
  session on the main lifts. Recovers fast. Tolerates lower volume
  with high frequency.
- **Intermediate** — roughly 6 months to 2–3 years. Linear
  progression has stalled; weekly progression is the new unit.
  Responds best to mid-volume mid-frequency programs.
- **Advanced** — 3+ years of focused training, near genetic-ceiling
  on at least one lift. Needs periodized waves of volume and
  intensity; daily and weekly autoregulation matter more than
  monthly progression.

Training age is not training years. Someone who has "trained for
five years" doing a circuit class three times a week is a novice
under load.

## 2. Set weekly volume per muscle group

Anchor volume in published landmarks (Schoenfeld et al. on dose
response; Israetel's MEV / MAV / MRV framing). Hard sets per muscle
group per week, taken close to failure (RPE 7–9):

- **Novice** — 8–12 sets / muscle / week. More is wasted recovery.
- **Intermediate** — 10–20 sets / muscle / week. Most fall in the
  12–16 range.
- **Advanced** — 14–25+ sets / muscle / week, but with mandatory
  deloads every 4–6 weeks. The ceiling is real.

A "hard set" is a set within 0–4 RIR. Warm-ups don't count. Sets to
absolute failure cost more recovery than they're worth on most
movements (squats, deadlifts) — leave 1–3 in the tank on compounds,
push closer to failure on isolations.

## 3. Pick session frequency per muscle group

Each muscle group is best hit **2–3x per week** for hypertrophy and
strength. One-bodypart-per-day "bro splits" leave volume on the
table for natural lifters; full-body-every-day buries recovery.

Common splits that obey 2x frequency:

- **Upper / Lower** — 4 days, simple, durable.
- **Push / Pull / Legs ×2** — 6 days, requires real recovery.
- **Full-body ×3** — 3 days, ideal for novices.
- **Push / Pull / Legs / Upper / Lower** — 5 days, intermediate
  sweet spot for hypertrophy.

## 4. Exercise selection: compound primary, accessory secondary

Each session has a hierarchy:

- **Primary (1–2 movements)** — heavy compound, 3–6 sets, 3–8 reps,
  RPE 7–9. Squat / bench / deadlift / overhead press / weighted
  pull-up / row variants.
- **Secondary (2–3 movements)** — compound or machine compound,
  3–4 sets, 6–12 reps, RPE 7–9. RDLs, dips, incline DB press,
  lunges, pulldowns.
- **Accessory (2–4 movements)** — isolation, 2–4 sets, 8–20 reps,
  RPE 8–10. Curls, lateral raises, leg curls, calf work, ab work.

Pick exercises the user can perform with technique they own. A
front squat the user grinds with kyphotic upper back is a worse
quad builder than a leg press they execute clean.

## 5. Load by RPE / RIR, not by yesterday's number

RPE (Rate of Perceived Exertion, 6–10) and RIR (Reps In Reserve)
are the same scale inverted: RPE 8 = 2 RIR, RPE 9 = 1 RIR, RPE 10
= 0 RIR.

Prescribe in target ranges:

- "5 reps @ RPE 8" — work up to a weight that produces 5 reps with
  2 left in the tank.
- "3 sets of 8 @ RPE 7" — pick a weight where the first set has 3
  in reserve; expect later sets to drift toward RPE 8–9.

This handles bad sleep, life stress, food intake, and warm-up
quality automatically. Beats fixed-percentage programming for
non-elite lifters.

## 6. Progressive overload — three lanes, not one

Novices add weight nearly every session. Intermediates need to
diversify:

- **Weight PRs** — same reps, more load. Hardest to keep coming.
- **Rep PRs** — same load, more reps. Cheapest, ignored most.
- **Set PRs** — same load × reps, more sets. Adds weekly volume.

Rotate. A four-week mesocycle might add reps weeks 1–2, add weight
in week 3, and deload in week 4.

## 7. Output

Emit the program as a `:::artifact` block. Include for each session:

- Movements in priority order
- Set × rep × RPE/RIR target
- Substitutions if the gym lacks the equipment
- A single "focus cue" the user holds across the session (e.g.
  "brace before unrack, hold through the rep")

If the user is voice-first, also emit one short `:::audio-cue` per
primary movement — the line you'd actually say between their sets.
