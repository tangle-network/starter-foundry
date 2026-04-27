# Voice audit

Voice is the cumulative effect of choices the writer makes at the
sentence level — rhythm, diction, distance, what the prose
notices, what it skips. A voice audit runs a 500-word sample
through a fixed checklist, names the patterns that are working,
and flags the patterns that are working *against* the writer's
apparent intent.

Default output: `:::artifact` titled `Voice Audit — <slug>` with
each section marked **CLEAN / PATTERN / DRIFT**, and at most three
`:::suggestion` blocks for the highest-leverage line edits.

## Sample selection

Audit a 500-word continuous passage chosen by the writer — not a
patchwork. Patterns surface only at sustained length. If the
writer offers a longer chunk, sample 500 words from the middle
(openings and endings are often unrepresentatively polished).

## Checklist

1. **Habitual sentence rhythms.**
   Count sentence lengths. Note the median, the variance, the
   rhythm pattern (short-short-long? long-long-comma-long?).
   Healthy prose varies; voice prose has a *signature* rhythm
   that varies inside its signature. Flag DRIFT if every sentence
   is the same length, or if rhythm collapses into a metronome.

2. **Filter words.**
   Filter words distance the reader from the POV character's
   experience. Flag every instance of:
   - **Perception filters**: *seemed*, *felt*, *noticed*,
     *watched*, *heard*, *saw*, *realized*, *thought*,
     *wondered*, *knew*, *understood*.
   - **Hedge filters**: *kind of*, *sort of*, *almost*,
     *nearly*, *somewhat*, *a bit*.
   - **Inception filters**: *began to*, *started to*, *was about
     to*. Usually replaceable with the verb itself.
   PATTERN if filters appear more than ~3 per 500 words; DRIFT
   above ~8.

3. **Passive voice patterns.**
   Active vs passive isn't a moral question — passive serves
   when the patient matters more than the agent. Flag passive
   constructions and ask: is the writer choosing this for
   emphasis, or defaulting? PATTERN if passive carries more than
   ~15% of finite verbs.

4. **Dialogue tag overuse / underuse.**
   Best practice: lean on `said` (and `asked`); use action beats
   for attribution; avoid said-bookisms (*hissed*, *barked*,
   *exclaimed*) unless the verb is precisely accurate. Adverbs
   in tags (*she said angrily*) almost always signal the
   dialogue isn't carrying the emotion. Flag PATTERN at >2
   said-bookisms or >3 tag-adverbs per 500 words.

5. **Exposition dumping.**
   Mark any paragraph that is pure backstory, world-building, or
   "as you know, Bob" delivered through dialogue. A 500-word
   sample with more than one expositional dump is a PATTERN.

6. **Head-hopping in close third POV.**
   In close third the camera lives inside one character's
   perception. Flag any sentence that grants access to another
   character's interior thought. DRIFT if more than one slip per
   500 words.

7. **Telling vs showing.**
   Mark sentences that *tell* an emotion ("she was furious")
   versus *show* it through behavior or sensory detail ("her
   hands wouldn't unclench"). Both have their place. Flag PATTERN
   when high-stakes moments are told and low-stakes connective
   tissue is over-shown.

8. **Diction cohesion.**
   Note the prevailing register (plain, ornate, ironic, lyric,
   colloquial). Flag any sentences that break the register
   without earning the break.

9. **Concrete vs abstract.**
   Count concrete nouns (apple, doorknob, gravel) vs abstract
   nouns (love, justice, sadness) per paragraph. Voice prose
   chooses; it doesn't drift toward abstract by default.

## Output

For each of the nine checklist items, mark CLEAN / PATTERN /
DRIFT and write one sentence of evidence ("filter words: 6
instances, mostly *seemed* and *felt* in close third — recommend
direct sensory verbs"). Then write a 2–3 sentence "voice
signature" capturing what's *working* — this is the most
important output. Coaches who only flag problems leave the writer
thinking their voice is broken when it usually isn't.

Cap suggestions at three.

## Cross-medium use: voice signature for cover briefs

When the illustrator is briefing a cover (Example 6 in
`coordination-protocol.md`), the voice signature is the
load-bearing artifact. The illustrator's job is to translate the
voice into visual language; they need the signature in a form
they can use.

When the audit is run for a cover-brief context, expand the voice
signature to a paragraph that names:

- **Pace** — does the prose move slowly, accumulate, sprint?
- **Sensory bias** — what does the prose *notice*? Light? Sound?
  Texture? Weather?
- **Emotional register** — withheld, demonstrative, ironic,
  earnest?
- **Period / influence** — does this prose live in the
  late-modernist tradition? Contemporary minimalism? Maximalist
  postmodern?
- **Forbidden visual signifiers** — what would *break* the voice
  on a cover? (e.g., "no torn-paper effect; no urban-thriller
  serif; no genre stock photography.")

Hand the signature to the illustrator via the writer (the artist
is in the loop; you don't bypass them). The illustrator returns
visual proposals; you do not redesign the cover, and you do not
modify the prose to fit the cover.

## Cross-medium use: voice fidelity for adaptations

When the screenwriter is adapting source prose, they may ask for
a voice-signature read to inform what the adaptation must
preserve. Run the audit on a 500-word sample from the source.
Hand the signature to the screenwriter as a *constraint* on the
adaptation:

- "The source's voice is sparse and image-heavy; the script's
  action lines should match (short, declarative, image-led; no
  elaborate description)."
- "The source uses free indirect for the protagonist; the script
  cannot use V.O. without breaking that posture."
- "The source's value-shift on this chapter lands on a *visual*
  beat; the script should not externalize it through dialogue."

The screenwriter writes the adaptation; you do not. They return
to you for fidelity-check passes if the writer (the source's
author) wants them.

## Coach posture

The audit is a mirror. The writer decides what to fix. Voice is
not consensus prose — quirks the audit flags as PATTERN may be
exactly what the writer wants to keep. Name the choice; let them
own it.

Cap suggestions at three. Pick the three that, made across the
manuscript, would most strengthen the voice the writer already
has.
