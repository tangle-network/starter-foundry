# Composition canvas

A structured brief that aligns an illustration's visual direction
*before* line goes to paper. Catches the most expensive mistakes
(wrong audience, wrong format, wrong tone) at the cheapest stage.

Default output: `:::artifact role=illustrator template=composition-canvas`
filled in collaboratively with the artist (the lead artist on the
project, per Rule 3 in `coordination-protocol.md`).

## Sections

### 1. Project context

- **Medium**: digital, print, animation, motion comic, storyboard,
  cover, key-art, etc.
- **Audience**: demographic + psychographic + context of viewing.
  ("Adult literary fiction readers, encountering the cover at a
  bookstore display.")
- **Tone**: whimsical / serious / surreal / minimal / lyric /
  procedural / etc. If the lead artist is a novelist or
  screenwriter, *their voice signature* is the tone source.
- **Lead artist** (per Rule 3): who started the project? They set
  style. You propose alignment.

### 2. Visual references

- **Mood board**: 3–5 reference images or styles, described in
  text. Name what the references *do*, not just who made them.
  ("Kara Walker's silhouette work — the negative-space drama, not
  the historical content.")
- **Key influences**: artists, movements, existing works.
- **Voice signature** (when the lead is a novelist or
  screenwriter): the voice paragraph from the novelist-coach's
  voice audit, or the screenwriter's tone reference. This is a
  constraint, not an inspiration.

### 3. Constraints

- **Color palette**: brand colors, limited palette, or open. Note
  any forbidden palettes (e.g., "the novelist forbids
  thriller-genre red/black").
- **Format**: aspect ratio, resolution, bleed, trim. (For
  storyboards: aspect ratio matches the script's intended exhibition
  ratio — 2.39:1 for anamorphic, 1.85:1 for flat.)
- **Deadline** + **deliverables count** (single image, series of N,
  etc.).

### 4. Composition framework

Pick the framework that fits the brief; multiple may apply:

- **Rule of thirds.** Divide the frame into a 3×3 grid; place key
  elements along the lines or at intersections. Default for
  general-purpose composition.
- **Golden ratio (Phi spiral).** Lead the eye along a logarithmic
  spiral. Strongest for dynamic, organic subjects.
- **Leading lines.** Roads, rivers, gaze, gesture — direct
  attention to the focal point. Strongest when the subject is at
  the line's end.
- **Framing.** Foreground elements (windows, arches, foliage)
  frame the subject. Adds depth + intimacy.
- **Negative space.** Let empty areas balance the composition. The
  literary-cover aesthetic; restraint is the message.
- **Symmetry / asymmetry.** Symmetry reads formal, stable, calm;
  asymmetry reads dynamic, tense, alive. Don't mix without
  intent.
- **Dynamic vs static.** Lines on the diagonal vs. orthogonal.
  Diagonal moves; orthogonal sits.

### 5. Checklist (before "done")

- [ ] Focal point is clear.
- [ ] Eye path is intentional.
- [ ] Balance of positive and negative space.
- [ ] No awkward tangents (a line in the background that "kisses"
      a subject's outline) or cropped limbs.
- [ ] Depth cues (overlap, size relation, atmospheric perspective)
      are present and consistent.
- [ ] Composition supports the lead artist's voice. If the lead
      artist's voice is sparse and image-heavy, a busy
      composition fights it; check.

### 6. Deliverables and finish level

- What is being produced (single, series, storyboard panel, cover
  comp).
- Level of finish (sketch, line, value study, full color).
- Iteration plan (how many rounds before lock).

### 7. Success criteria

What makes this *effective* for the brief? Emotional response?
Clarity? Brand alignment? Voice fidelity?

## Cross-medium variant: cover for a novel

When the brief is a novel cover (handoff from novelist-coach,
Example 6 in `coordination-protocol.md`):

- **Lead artist is the novelist.** You read their voice signature
  (from the coach's voice audit, expanded to the cover variant in
  `voice-audit.md`); you do not impose your own visual aesthetic.
- **Forbidden signifiers are real.** When the voice audit says
  "no torn-paper effect; no urban-thriller serif; no genre
  signifiers," obey it. The audit is a constraint, not a
  suggestion.
- **One iteration per round.** Cover work is high-context; the
  novelist + their editor sign off, not you. Don't fire off
  variants without their input.
- **Surface trade-offs, don't decide.** "A high-contrast palette
  pops at thumbnail size but feels harsh at trim size; a
  low-contrast palette holds the voice but loses retail shelf
  presence — your call."

## Cross-medium variant: storyboard panels

When the brief is a storyboard run (handoff from screenwriter,
Example 5):

- **Lead artist is the writer.** Match their tone reference.
- **Aspect ratio matches the writer's exhibition target.**
- **Beat count is fixed by the script.** You don't add beats; you
  honor the writer's beat structure.
- **Flag 180°-line breaks** the writer marked, plus any you
  introduce.
- **Return panels as described thumbnails** (text descriptions; you
  do not emit raster images).
- **If a panel composition would shoot stronger but breaks the
  action lines**, emit `:::handoff to: screenwriter` per Example 2.
  The writer decides.

## Anti-patterns to refuse

- Filling the canvas without the lead artist in the room. They
  set style.
- Substituting your aesthetic preference for their voice.
- "Approving" a final design as ready for production. That's a
  human professional's call (`:::escalation`).
- Producing variants without their input — burns iteration cost
  on guesses.

*Use this canvas to start every art-direction conversation. Fill
it out collaboratively with the lead artist. Treat it as a living
document — fields update as the brief sharpens.*
