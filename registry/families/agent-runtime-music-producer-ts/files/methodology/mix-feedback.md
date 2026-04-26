# mix-feedback

A pass on a candidate mix. The output is a `:::artifact` packet the artist takes back to the DAW.

## Inputs

- One candidate mix (rough, demo, near-final — works at any stage)
- One or two reference tracks the artist named, OR run `tools/find-references.sh "<direction>"` if they didn't name any

## Procedure

```
# 1. Map the candidate
tools/arrangement-map.py candidate.wav

# 2. Fingerprint candidate + every reference
tools/analyze-audio.sh candidate.wav
tools/analyze-audio.sh reference-1.wav
tools/analyze-audio.sh reference-2.wav

# 3. A/B against the closest reference
tools/compare-tracks.sh candidate.wav reference-1.wav

# 4. If a specific element is in question, isolate it
tools/extract-stems.sh candidate.wav /tmp/stems
# → listen to /tmp/stems/htdemucs/candidate/{vocals,drums,bass,other}.wav
```

Now you have:
- Section-by-section timeline with timestamps + tempo
- Loudness / dynamics / spectral fingerprint of candidate and each reference
- Concrete deltas with plain-language verdicts (loudness, dynamics, low-end, air)
- Stems for any element worth listening to in isolation

## What goes in the `:::artifact`

Pick **one or two** changes — the ones with the most leverage. Be specific.

A mix-feedback artifact looks like:

```
:::artifact id=mix-feedback-2026-04-26 title="Mix feedback — track-3-rough-v4"

## Top of the list (one note)
[2:14 → 2:31, the second chorus hit] candidate is +2.4 LU louder than the
reference but the LRA is 1.8 LU narrower — over-limited at the master.
Pull the master ceiling 2 dB and let the chorus breathe; the dynamic
contrast is the hook here, the loudness war isn't.

## Worth knowing (take or leave)
- Low-end is +3 dB heavier than reference below 250 Hz. Could be the
  kick at 60 Hz fighting the sub-bass; check if both are bus-compressed
  to the same compressor — that's where I'd start.
- [3:42] vocal de-essing seems to have nuked the air; the "s" sounds
  more like a "th." Move the de-esser threshold up 4 dB or split-band it.

## Numbers (for your records)
candidate:  -8.2 LUFS / -0.6 dBTP / 5.1 LRA
reference:  -10.6 LUFS / -1.1 dBTP / 6.9 LRA
:::
```

## Anti-patterns to refuse

- A wall of 12 fixes. Pick one. The artist isn't going to do 12.
- Declaring "this is ready to release" — that's a mastering engineer's call. Surface that handoff explicitly if asked.
- Suggesting changes without a reference anchor. "I'd boost 4kHz" is taste; "the reference has +3dB at 4kHz and it makes the snare cut, your candidate doesn't" is a basis.
- Faking precision you didn't measure. If you didn't run the tool, don't write the number.

## When to escalate

Almost never. The two real escalations:
- Artist asks "is this ready to release?" → mastering engineer.
- Artist asks you to reproduce a specific lyric / melody from a copyrighted track → no; reframe as "what's the *function* of that hook so we can build our own."
