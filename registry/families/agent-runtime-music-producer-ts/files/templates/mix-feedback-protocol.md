# Mix feedback protocol

Methodology for reviewing a mix. The goal is *honest ears*, not
spec-sheet validation. A mix that hits every target and feels dead
fails. A mix that breaks the rules and moves the listener wins.
Targets are floors, not goals.

## Step 1 — Calibrate before listening

- **Monitoring level**: 75–85 dB SPL at the listening position
  (C-weighted, slow). Quieter and the bass disappears; louder and
  the upper mids fatigue your ears within minutes.
- **Room**: pause if the room is untreated. Honest feedback from a
  bad room is worse than no feedback. Use closed-back headphones
  (Sennheiser HD 600 / Audeze LCD-X / Sony MDR-7506) as the
  fallback; flag the limitation in the notes.
- **Reference loudness**: integrated LUFS, not peak. Master bus
  meter on.

## Step 2 — Reference-track A/B

Pick 2–3 reference tracks the artist trusts, in the same genre and
era. Loudness-match them to the user's mix (gain-match by integrated
LUFS, not peak — usually pull the references down 4–8 LU to sit
beside an in-progress mix). Then A/B in 8-bar slices.

What you're comparing:

- Low-end weight and tightness
- Vocal sit (front of mix? cradled in reverb? dry and present?)
- Stereo width (mono-collapsed test: does it survive?)
- Top-end air vs harshness
- Transient feel (snappy? round? smacked?)

## Step 3 — Frequency-balance scan

Listen for problems in each band:

- **Sub (20–60 Hz)**: rumble, untuned room modes, kick/bass
  collision. Most non-bass elements should be high-passed at
  30–40 Hz; non-kick, non-bass elements often higher (60–120 Hz).
- **Low (60–250 Hz)**: boomy or boxy. The 200–300 Hz band is the
  classic "boxy" zone — listen for buildup from too many
  mid-cut instruments stacking.
- **Low-mid (250–500 Hz)**: muddy, congested. Often the fix is
  subtractive on guitars and pads, not boost on the lead.
- **Mid (500 Hz–2 kHz)**: where the ear lives. Vocal intelligibility
  hides here. Masking shows up as a vocal that "sounds fine solo"
  but disappears in the mix.
- **Upper mid (2–5 kHz)**: harsh, fatiguing. The ear is most
  sensitive here (Fletcher-Munson). If the mix tires you in 30
  seconds, this band is the suspect.
- **High (5–10 kHz)**: presence, sibilance. De-ess vocals before
  bus compression, not after.
- **Air (10–20 kHz)**: openness. Use shelves, not bells. Modern
  mixes often shelve +1–2 dB above 10 kHz on the master.

## Step 4 — Frequency masking analysis

Two elements occupying the same band fight; one wins, the other
turns to mud. Common culprits:

- Kick + bass at 60–80 Hz → side-chain or carve a 60 Hz dip in the
  bass when the kick hits
- Lead vocal + rhythm guitar at 1–3 kHz → notch the guitar where
  the vocal lives
- Snare + claps at 200 Hz → high-pass one of them

Solve masking in EQ, not volume. Turning an element up to "win" the
mask just escalates the war.

## Step 5 — Dynamic range / LUFS

Streaming-platform integrated-LUFS targets (post-normalization, so
not absolute):

- Spotify: −14 LUFS integrated
- Apple Music: −16 LUFS integrated
- YouTube: −14 LUFS integrated
- Tidal: −14 LUFS integrated
- Broadcast (EBU R128): −23 LUFS integrated

Aim the master at −14 LUFS for streaming, true peak ≤ −1.0 dBTP.
Going louder than the platform target gets the track pulled back —
you lose dynamic range *and* gain nothing in perceived loudness.
Crest factor (peak − RMS) below 6 dB is over-compressed; 8–12 dB
is healthy modern range.

## Step 6 — Stereo field

- **Phase-correlation meter**: should hover positive, dip into
  negative only briefly (FX, wide reverbs).
- **Mono check**: collapse the master to mono. Anything that
  disappears (wide chorus on vocal, Haas-trick guitars) is at risk
  on phone speakers, club PAs, and car-radio sums.
- **Stereo placement**: kick / snare / bass / lead vocal stay
  centered. Width comes from background vocals, pads, FX, hats, and
  doubles. A wide center sounds impressive in headphones and falls
  apart everywhere else.

## Step 7 — Common pathologies (rank by severity)

1. Boomy lows — fix with HP filters on non-bass elements at 30–40
   Hz, dynamic EQ on the 200 Hz region of the bass
2. Harsh upper mids — pull 2–4 kHz on whatever's stabbing
   (often the lead vocal or hi-hats), check de-essing
3. Narrow stereo — add width to background vocals and pads, not
   the lead
4. Buried vocal — check 1–3 kHz masking from guitars/synths first,
   then automate vocal volume per-section, then consider parallel
   compression
5. Lifeless transients — pull bus compression ratio down, raise
   threshold, or move comp later in the chain

## Step 8 — The one or two notes

Same discipline as arrangement review: don't ship a 12-point fix
list. Pick the highest-leverage change and frame it as a hypothesis
the artist can A/B in one session.

## Output

Emit a `:::artifact` block containing:

- Reference tracks used (loudness-matched)
- Frequency-balance findings per band
- Masking pairs identified
- Loudness measurement (integrated LUFS, true peak, crest factor)
- Stereo / mono-compatibility findings
- The one or two prioritized changes
- Hard caveat: commercial-release readiness is the mastering
  engineer's call, not yours
