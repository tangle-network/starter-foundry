# listening-prompt

Daily listening discipline — a 15-minute prompt the cron triggers each
afternoon. The goal is to keep the artist's reference library current
and their ears calibrated. Most "I don't know what's wrong with this
mix" moments are a calibration problem, not a mix problem.

## Procedure

```
# 1. Surface 3 reference candidates for the artist's current direction
tools/find-references.sh "<the project's stated direction>"

# 2. Fingerprint each
for ref in ref1 ref2 ref3; do
  tools/analyze-audio.sh "$ref"
done

# 3. Pick the one that's furthest from the candidate's current shape
# (biggest delta on either dynamics or low-end balance)
tools/compare-tracks.sh candidate.wav <chosen reference>

# 4. Hand the artist a 15-minute listening assignment
```

## What goes in the `:::artifact`

```
:::artifact id=listening-2026-04-26 title="Listening — Tuesday"

## Today's reference
[Track Title] — Artist
Why this one: of the three I surfaced, this is the furthest from your
current candidate on dynamics. Yours: 5.1 LRA. Theirs: 8.7 LRA. That
3.6 LU gap is what's making your mix feel "stuck" vs theirs feeling
"alive."

## What to listen for (15 min, monitors at 75-85 dB SPL)
1. The bass — is it consistent in level, or does it duck when the
   vocal lands? Try to hear the side-chain that isn't there in yours.
2. The vocal sibilance — clean or sharp? Where does the de-essing
   reveal itself?
3. The drop's first downbeat — what got *louder*, and what got
   *thinner*? (This is a contrast-by-removal trick.)

## After listening
Take one of those three observations and try it on your candidate
this week. Don't try all three; pick the one that surprised you
most.
:::
```

## Voice mode (when stacked with phony-voice)

The listening prompt works well as a voice-first interaction: the
agent reads the artifact aloud, then *waits* for the artist to
listen, then prompts them to dictate what they heard. The voice mode
matters because most producers don't read; they listen. Set the
agent's TTS profile to a calm conversational voice, not a TV
narrator.

## Anti-patterns to refuse

- Picking a reference the artist hasn't listened to. Always offer 3, let
  them choose.
- Demanding a "report" from the artist. The artifact is the artist's;
  they take what's useful, leave the rest.
- Repeating the same reference twice in a week. Library breadth is the
  point.

## When to build a new tool

- "I want to know what songs in my library have similar tempo + key + LRA
  to this one" — write a tool that walks a directory and returns a
  ranked list. Ship it. Use it in the listening prompt.
- "I want to know if the artist actually listens" — track artifact
  acknowledgements over time and surface the listening-streak when
  it lapses. (Don't shame; just notice.)
