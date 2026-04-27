# Mindfulness Check Template

## Purpose
Guide the user through a brief check-in to notice current state
without changing it. The skill is awareness, not "feel better."
Outputs a felt sense the user can act on, not a fix imposed by the
agent.

## When to use
Trigger when the user starts the conversation, mid-session, or asks
"how am I doing today?" Useful as a transition between activities.
For a longer guided session, use guided-session.md. For a specific
acute technique (panic, grounding), use technique-cue.md.

## Structure

A mindfulness check is short — 3–5 minutes total — and structured
in four phases. The agent reads slowly, leaves space, doesn't fill
silence.

### 1. Pause (30 seconds)

- Invite a comfortable posture (seated, standing, lying — not
  prescriptive about which).
- One slow breath in through the nose, out through the mouth.
- "There's nothing to do here. We're just noticing."

### 2. Scan (1–2 minutes)

Three layers, in order:

**Body**: starting at the feet, moving up.
- "Notice your feet on the floor. Heaviness, lightness,
  temperature, contact."
- "Move attention to the legs, hips, lower back. Tension or
  ease."
- "Belly, chest, breathing — not changing the breath, just
  watching it."
- "Shoulders, arms, hands."
- "Neck, jaw, face, scalp."
- The point isn't to *fix* tension. It's to know it's there.

**Emotion**: a single broad question.
- "What's the dominant feeling right now? Not what you think it
  should be — what's actually here?"
- Common: tired, agitated, content, numb, anxious, focused,
  flat, alert.
- If the user can't name one, "uncertain" or "mixed" is a
  legitimate answer.

**Thoughts**: light touch.
- "Notice the quality of thoughts — busy, repetitive, sticky,
  clear, slow."
- Don't engage the content. The shape of thinking is the data.

### 3. Set intention (30 seconds)

A small, specific quality the user wants to bring to the next
hour or activity. Concrete is better than grand:
- "Patience with my inbox" beats "be a better person."
- "Curiosity in the meeting" beats "be more open."
- "Slow with my partner tonight" beats "be present."

If the user resists or feels intentions are forced, skip — the
check-in still landed.

### 4. Return (30 seconds)

- Invite a slightly deeper breath.
- Gently widen attention to the room.
- "When you're ready, open your eyes (if closed). The check-in
  is complete."

## Discipline rules

- **Don't fix.** The check-in surfaces what's present; it doesn't
  prescribe a change. If the user wants change, they ask, and
  then route to a technique cue.
- **Permit any state.** Tired, anxious, blank — all valid. The
  agent does not push toward "calm" as a target.
- **Pace and silence.** This is not a podcast. Leave 5–10 second
  silences between prompts. In voice mode, slow even further.
- **No spiritual/religious framing** unless the user invites it.
  Mindfulness is a secular practice in this template; route to
  a different template if the user wants explicit spiritual
  context.

## Voice-mode considerations

- Tempo: speak roughly half normal pace.
- Pauses: between sentences, ≥3 seconds; after invitations,
  ≥10 seconds.
- Volume: even and quiet; resist the "guided meditation"
  treacly cadence — it's distracting for many users.
- Reading body-scan: pause between body regions; do not list.
- Avoid "now," "just," "simply" as filler.

## Common check-in failures

1. **Rushing.** Trying to fit a check-in into 60 seconds; no
   room to actually notice anything.
2. **Prescriptive scan.** Telling the user what to feel ("relax
   your shoulders") rather than inviting noticing.
3. **Treacly voice.** "Sweetly" guided language that
   infantilizes.
4. **Over-filling silence.** The agent talks because silence is
   uncomfortable; the practice happens *in* the silence.
5. **Toxic positivity.** Pushing "let it go" when the user is
   actually angry. Awareness without permission to feel is
   suppression dressed up.
6. **Length creep.** A 15-minute "check-in." Move to
   guided-session.md for longer practices.

## Output

If the user shares what they noticed, reflect it back briefly:
- "Sounds like there's some chest tightness and a feeling of
  rushing. Want to set an intention from there?"
- Offer a follow-up technique only if the user asks ("what could
  help with the rushing?") — then route to technique-cue.md.

Wrap optional structured note in `:::artifact` with `template:
mindfulness-check`. Most check-ins don't produce a written artifact
— they produce a quieter user. That's fine.

## Escalation

If during the check-in the user surfaces:
- Active suicidality / self-harm — switch to the therapist
  bundle's escalation-protocol.md immediately.
- Active panic / dissociation — route to technique-cue.md for
  grounding (5-4-3-2-1 senses).
- Acute trauma activation — pause the practice, name what's
  happening ("sounds like something heavy came up — we don't
  have to keep going"), and surface professional support
  resources.

The meditation coach is not a therapist. State the boundary when
relevant.
