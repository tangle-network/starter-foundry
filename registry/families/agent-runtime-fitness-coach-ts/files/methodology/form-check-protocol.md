# Form-Check Protocol — Methodology

Best case: the user uploads a video shot from the side at hip
height, full body in frame, no music to distract from the bar path.
Voice-only fallback: walk the user through a self-described
five-point check while they hold the position.

State the limit upfront. You are not in the room, you cannot palpate
joints, and a video crops out the parts that often matter most
(feet, breath, ribcage). If anything in the check trips a red flag,
refer to an in-person coach or a PT — don't program around it.

## The five-point check (apply per lift)

For every barbell lift, evaluate the same five elements in the same
order. Skipping order is how you miss things.

### Squat (low-bar or high-bar)

1. **Depth** — hip crease below the knee crease at the bottom.
   Shallower is fine for some goals (powerlifters at federation
   depth, athletes at sport-specific ranges) but call it out
   explicitly; don't pretend a quarter squat is a full squat.
2. **Knee tracking** — knees in line with toes through the descent.
   Mild dynamic valgus on the concentric is common in strong
   lifters and not automatically a fault; sustained collapse is.
3. **Hip / torso angle** — torso should stay in a consistent
   forward angle through the rep. Hip-shooting (hips rising faster
   than chest out of the hole) shifts load to the lower back.
4. **Brace** — air in before unrack, ribcage stacked over pelvis,
   intra-abdominal pressure held through the rep. A belt amplifies
   a brace; it doesn't replace one.
5. **Bar path** — vertical line over midfoot, both descent and
   ascent. Bar drift forward = quad-dominant or weak upper back;
   bar drift back = falling out of the hole.

### Bench press

1. **Setup** — feet planted, shoulder blades retracted and
   depressed, mild arch (lumbar, not thoracic crunch), eyes under
   the bar.
2. **Bar path** — touches roughly nipple line for a powerlifting
   bench, slightly higher for an upper-chest emphasis. Slight
   J-curve to lockout is normal.
3. **Elbow angle** — 45–75° from torso, not 90° (shoulder-eating)
   and not tucked tight to ribs unless the user is pressing for
   triceps.
4. **Wrist stack** — bar over wrist over elbow at the bottom. Bent
   wrists = lost force, sore wrists.
5. **Leg drive & glutes** — glutes stay on the bench (paused-bench
   rule); leg drive transmits through the spine into the bar.

### Deadlift (conventional)

1. **Setup** — bar over midfoot, shins close to the bar (just shy
   of touching), shoulders slightly in front of the bar, lats
   engaged.
2. **Hip / shoulder timing** — hips and shoulders rise together off
   the floor. If hips rise first, the back will round under load —
   stop the rep.
3. **Lumbar position** — neutral spine through the lift. A small
   rounding of the upper back at heavy weights is common in
   advanced lifters; lumbar flexion under heavy load is a stop
   signal every time.
4. **Lockout** — full hip extension without leaning back past
   neutral. Hyperextending the spine at lockout is a fashion
   choice with a real cost.
5. **Lowering** — the rep is not done at lockout. Hinge first,
   bend the knees second, control the descent.

### Overhead press

1. **Bar path** — vertical from clean rack to lockout overhead. The
   head moves out of the way and back through.
2. **Elbow position at start** — slightly in front of the bar; not
   flared wide.
3. **Glute / abdominal brace** — squeeze glutes and brace the
   midsection to prevent lumbar hyperextension.
4. **Lockout** — bar over shoulders over hips over midfoot. Stack
   joints, don't lean.
5. **Wrist stack** — bar in heel of palm, neutral wrist, not bent
   back.

### Row (any horizontal pull)

1. **Hip hinge** — torso fixed at chosen angle, hips hinged, knees
   soft. Not a leg-drive cheat row unless that's the prescribed
   variant.
2. **Bar / handle path** — pulled to lower chest / upper abdomen
   with elbows traveling back, not flared.
3. **Scapular control** — shoulder blades retract and depress at
   the top; protract on the descent.
4. **Lumbar position** — neutral. Same rule as deadlift: lumbar
   flexion under load is a stop.
5. **Tempo** — controlled negative; no momentum-driven swing
   unless explicitly prescribed.

## Red flags — stop the lift, don't program around

- Sharp pain (not effort, not stretch — pain). Joint-line, sudden,
  localized.
- Lumbar flexion under load on any pulling movement.
- Persistent dynamic valgus (knees collapsing inward) under heavy
  squat / deadlift load that does not respond to cueing.
- Shoulders rolling forward into protraction during bench (not the
  same as scapular movement; this is the joint giving up
  position).
- Visible asymmetry — one hip rising before the other on a squat,
  one arm finishing a press before the other. Refer to PT before
  doing more loaded reps.

When any red flag fires, emit a `:::escalation` block: name the
professional (PT for joint pain or asymmetry; in-person coach for
persistent technique faults that resist cueing) and stop programming
the offending pattern until they've been seen.

## When to refer to an in-person coach

- The user has tried 2–3 cued sessions without resolution.
- The fault repeats across multiple lifts (e.g., bracing fails on
  squat AND deadlift AND OHP).
- The user is competing — at that point, an in-person eye on bar
  path and timing is worth more than any video review.
- The lift is olympic-style (snatch, clean & jerk). Voice / video
  cueing is too low-bandwidth for these; refer to a USAW-credentialed
  coach.

## Output

Emit the form check as a `:::artifact` block with:

- The lift, the variant, the loading at the time of the video.
- Each of the five points: rated PASS / WATCH / FAULT.
- One specific cue per WATCH or FAULT, kinesthetic and external-focus
  where possible.
- Any escalation triggered.
