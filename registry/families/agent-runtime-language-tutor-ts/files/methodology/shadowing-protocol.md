# Shadowing protocol

Shadowing is real-time mimicry of audio in the target language —
the learner repeats what they hear *as they hear it*, not after a
pause. It builds prosody, rhythm, and pronunciation faster than any
isolated drill. The protocol is voice-mode primary; without
`@ph0ny/sdk` STT/TTS the protocol degrades to "listen and repeat",
which loses most of the benefit.

## When this fires

Triggered on demand or scheduled by the host UI after a
conversation session where the learner asked about pronunciation,
struggled with a particular sound, or reached the end of a daily
session with time remaining.

Daily target: **5–10 minutes**. Diminishing returns past 10
minutes — fatigue degrades the prosody match.

## Audio source selection

Pick audio that is **slightly above the learner's current level**
(the i+1 band — same principle as comprehensible input). Sources
that work:

- A 30–60 second clip from a podcast in the target language at
  natural speed.
- A short scene from a film or TV show with clean dialogue (avoid
  music-bed, avoid heavy regional accents until B2+).
- A passage the agent itself synthesizes via TTS at a controlled
  rate — useful when the agent wants to drill a specific
  intonation pattern.

Avoid: news anchors (too formal), song lyrics (rhythm distortion),
audio with multiple overlapping speakers.

## Three-stage shadowing

Run the same passage through all three stages in one session.

### Stage 1 — Silent shadowing

The learner listens with full attention and *mouths* the words
silently along with the audio. No vocalization yet. The point is
to load the rhythm and mouth-shape pattern into motor memory
without the cognitive overhead of producing sound.

Duration: 2 passes through the passage.

### Stage 2 — Slow shadowing

Replay the audio at **0.75x speed** (TTS deployments do this
natively; recorded clips need a player that supports rate change).
Learner shadows aloud. The slower rate gives time to catch every
syllable; many learners discover sounds they were skipping.

Duration: 2–3 passes.

### Stage 3 — Full-speed shadowing

Replay at natural speed. Learner shadows aloud, accepting that the
first pass will feel sloppy. Speed will catch up after 2–3 passes.

Duration: 3–4 passes.

## Voice-mode integration

The agent's role during shadowing:

1. **Pronounce / play the source audio** via `@ph0ny/sdk` TTS or by
   surfacing an `:::audio-cue` block pointing at a specific
   timestamp range in a known clip.
2. **Capture the learner's shadow** via STT.
3. **Compare prosody, not transcription accuracy.** The STT
   transcript will *always* show errors during shadowing — that's
   normal because the learner is racing the audio. Compare:
   - Syllable count per phrase (did they keep up?)
   - Stress placement (did they hit the same stressed syllables?)
   - Intonation contour (rising / falling on the same words?)
4. **Recast feedback only.** "Great pace on the first half — try
   the rising tone on the question at 0:14 once more." Do not
   produce a transcript-level error report.

## Closing the session

Persist a `:::artifact` with:

- The audio source (URL or TTS prompt + speed setting)
- Which stages the learner completed
- One specific prosody win to remember ("you nailed the stress on
  *trabajamos*")
- One specific target for next time ("next session: the falling
  tone on negative sentences")

## What to skip

- Do not require perfect transcription. Shadowing is not dictation.
- Do not run shadowing for more than 10 minutes — fatigue ruins
  the signal.
- Do not pick passages above i+2 difficulty. If the learner can't
  parse 70% of the words at full speed, they aren't shadowing,
  they're guessing.
