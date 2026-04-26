# Voice Audit

Voice is the cumulative effect of choices the writer makes at the
sentence level — rhythm, diction, distance, what the prose notices,
what it skips. A voice audit runs a 500-word sample through a fixed
checklist, names the patterns that are working, and flags the
patterns that are working *against* the writer's apparent intent.

Anne Lamott's *Bird by Bird* and John Gardner's *The Art of
Fiction* are the source posture: show the writer what their prose
is doing so they can decide whether to keep doing it.

Default output: a `:::artifact` block titled `Voice Audit — <slug>`
with each section marked **CLEAN / PATTERN / DRIFT**, and at most
three `:::suggestion` blocks for the highest-leverage line edits.

## Sample selection

Audit a 500-word continuous passage chosen by the writer — not a
patchwork. The patterns surface only at sustained length. If the
writer offers a longer chunk, sample 500 words from the middle
(openings and endings are often unrepresentatively polished).

## Checklist

1. **Habitual sentence rhythms.**
   Count sentence lengths. Note the median, the variance, the
   rhythm pattern (short-short-long? long-long-comma-long?).
   Healthy prose varies; voice prose has a *signature* rhythm that
   varies inside its signature. Flag DRIFT if every sentence is
   the same length, or if rhythm collapses into a metronome.

2. **Filter words.**
   Filter words distance the reader from the POV character's
   experience. Flag every instance of:
   - **Perception filters**: *seemed*, *felt*, *noticed*,
     *watched*, *heard*, *saw*, *realized*, *thought*,
     *wondered*, *knew*, *understood*.
   - **Hedge filters**: *kind of*, *sort of*, *almost*, *nearly*,
     *somewhat*, *a bit*.
   - **Inception filters**: *began to*, *started to*, *was about
     to*. Usually replaceable with the verb itself.
   PATTERN if filters appear more than ~3 per 500 words; DRIFT
   above ~8.

3. **Passive voice patterns.**
   Active vs passive isn't a moral question — passive serves
   when the patient matters more than the agent. Flag passive
   constructions and ask: is the writer choosing this for
   emphasis, or defaulting? Common defaults: *was [verb]ed by*,
   *had been [verb]ed*, *it was [verb]ed*. PATTERN if passive
   carries more than ~15% of finite verbs.

4. **Dialogue tag overuse / underuse.**
   Best practice: lean on `said` (and `asked`); use action beats
   for attribution and tone; avoid said-bookisms (*hissed*,
   *barked*, *exclaimed*) unless the verb is precisely accurate.
   Adverbs in tags (*she said angrily*) almost always signal the
   dialogue isn't carrying the emotion. Flag PATTERN at >2
   said-bookisms or >3 tag-adverbs per 500 words.

5. **Exposition dumping.**
   Mark any paragraph that is pure backstory, world-building, or
   "as you know, Bob" delivered through dialogue. Ask whether the
   information could be doled out across scenes (drip), embedded
   in conflict (table-tennis), or trusted to the reader (cut). A
   500-word sample with more than one expositional dump is a
   PATTERN.

6. **Head-hopping in close third POV.**
   In close third the camera lives inside one character's
   perception. Flag any sentence that grants access to another
   character's interior thought ("she could tell he was
   nervous" — fine; "he was nervous" stated as fact in her
   close-third — head-hop). DRIFT if more than one slip per 500
   words; otherwise PATTERN with a note. (Omniscient is a
   different camera; verify which POV the writer is targeting
   before flagging.)

7. **Telling vs showing.**
   Mark sentences that *tell* an emotion ("she was furious")
   versus *show* it through behavior, sensory detail, or
   physiological response ("her hands wouldn't unclench"). Both
   have their place — telling moves the camera through low-
   stakes connective tissue; showing earns the high-stakes
   beats. Flag PATTERN when high-stakes moments are told and
   low-stakes connective tissue is over-shown.

8. **Diction cohesion.**
   Note the prevailing register (plain, ornate, ironic, lyric,
   colloquial). Flag any sentences that break the register
   without earning the break. Voice prose may shift register
   deliberately — a flat plain sentence dropped into ornate
   prose can land like a slap. Without intent, register-drift
   reads as inconsistency.

9. **Concrete vs abstract.**
   Count the concrete nouns (apple, doorknob, gravel) vs
   abstract nouns (love, justice, sadness) per paragraph.
   Abstract-heavy prose floats; concrete-heavy prose grounds.
   Voice prose chooses; it doesn't drift toward abstract by
   default.

## Output

For each of the nine checklist items, mark CLEAN / PATTERN /
DRIFT and write one sentence of evidence ("filter words: 6
instances, mostly *seemed* and *felt* in close third — recommend
direct sensory verbs"). Then write a 2–3 sentence "voice
signature" capturing what's *working* — this is the most important
output. Coaches who only flag problems leave the writer thinking
their voice is broken when it usually isn't.

Cap suggestions at three. Pick the three line edits that, if the
writer made them across the manuscript, would most strengthen the
voice they already have.

## Coach posture

The audit is a mirror. The writer decides what to fix. Voice is
not consensus prose — quirks the audit flags as PATTERN may be
exactly what the writer wants to keep. Name the choice; let them
own it.
