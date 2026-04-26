# Weekly listening prompt

Cron-driven listening practice. Producers who stop listening
critically stop producing well — the ear is a muscle and atrophies
fast. This protocol picks reference tracks across genres and
captures the artist's listening notes hands-free via voice mode.

## When this fires

The daily cron (`0 16 * * *`, 4pm local) triggers this flow once a
day. The full *weekly* protocol picks 3 tracks across distinct
genres; daily check-ins can be a single track follow-up on
yesterday's session. The agent decides based on listening-log
state.

## Step 1 — Pick 3 reference tracks (weekly)

Curate across at least three of these axes so the ear doesn't
calcify in one bucket:

- **Era**: a current release (last 6 months) + a canonical record
  from a different decade
- **Genre**: one in the artist's genre, two outside it
- **Production approach**: one heavily processed, one performance-
  forward, one deliberately lo-fi or unconventional

Avoid only picking records that "sound great." Records that *fail*
in interesting ways teach more than spotless ones.

## Step 2 — Frame each track

For each pick, surface in the prompt:

- Artist + track + year
- Why this one (production angle worth listening for: e.g.
  "vocal sit", "drum bus saturation", "stereo field on the
  bridge", "low-end discipline on phone speakers")
- One specific timestamp range to focus on (`:::audio-cue`
  pointing at e.g. 1:42–2:08)

## Step 3 — Voice-dictation listening session

Voice mode is the intended path. The artist plays the track on
their monitors, listens in the calibrated 75–85 dB SPL window, and
dictates notes via `@ph0ny/sdk` STT. The agent transcribes,
reflects back what it heard the artist say, and asks one follow-up
question per track.

Prompts to draw out specifics:

- "Where does the kick sit relative to the bass — under it, on top
  of it, or carved around it?"
- "How wide does the chorus feel? Does it survive in mono?"
- "What's the loudest 2 seconds of the track? Why?"
- "What's the one production move you'd steal? What's the one
  you'd skip?"

## Step 4 — Capture as :::artifact

Persist the session as a structured artifact:

- Date, tracks, timestamp ranges
- Per-track listening notes (transcribed)
- One actionable takeaway for the artist's own work-in-progress
- Open question to revisit next session

## Step 5 — Close the loop

Before signing off, surface one tie-back to the artist's current
project: "the way [reference] handles the second-chorus lift —
worth trying on your bridge?" This is the bridge from listening
*about* music to listening *for* a working session.

## What to skip

- Do not lecture. The artist is listening, not being taught.
- Do not pad the reference list. Three tracks is the cap;
  diminishing returns past that.
- Do not pick tracks the agent hasn't been able to verify exist
  and match the description. Hallucinated reference tracks are the
  fastest way to lose the artist's trust.
