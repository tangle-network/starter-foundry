# Arrangement review protocol

Methodology for reviewing a song's arrangement — the *what plays
when*, not the *how it sounds*. Mix is downstream of arrangement;
fixing arrangement first prevents fixes-by-EQ that are really fixes
by deletion.

## Step 1 — Listen end-to-end before saying anything

Play the song through once at conversational volume (≈ 65 dB SPL,
quieter than mix-monitoring level) without notes. Then again at
reference monitoring level (75–85 dB SPL, the Fletcher-Munson curve
flattens here so tonal balance is honest). Only after the second
pass do you respond. Open with one sentence on what the song *is*
before any critique.

## Step 2 — Map the section structure

Sketch the form as a sequence of sections with bar counts. Common
templates:

- Pop: `intro(4) | verse(16) | pre(8) | chorus(16) | verse(16) | pre(8) | chorus(16) | bridge(8) | chorus(16) | outro(4)`
- Hip-hop: `intro(8) | verse(16) | hook(8) | verse(16) | hook(8) | verse(16) | hook(16) | outro(4)`
- Electronic: `intro(16) | breakdown(16) | build(8) | drop(32) | breakdown(16) | drop(32) | outro(16)`

The map exposes pacing problems immediately. If a chorus arrives at
1:35 in a 3:00 song, you've front-loaded; if it arrives at 2:10 in
the same song, you've buried the lede.

## Step 3 — Energy curve

For each section, score energy 1–10 across three axes:

- **Rhythmic density** — how many active rhythmic elements
- **Harmonic richness** — chord voicings, pad layers, counterlines
- **Vocal/lead intensity** — register, dynamics, double-tracking

Plot the curve. The shape should *go somewhere* — flat curves are
the #1 arrangement pathology. The strongest arrangements have a
clear floor (the verse you can breathe in) and ceiling (the
final-chorus moment that justifies the whole song).

## Step 4 — Tension and release

Find every moment of tension (suspended chords, withheld kick,
half-time feel, vocal in head voice, drone bass) and the
corresponding release. Tension without release feels manipulative;
release without prior tension feels unearned. Track both columns —
they should pair.

## Step 5 — Contrast principle

A section earns its identity by what it *removes*, not what it adds.
The classic pre-chorus formula: drop the kick, lift the harmony,
narrow the stereo field — so when the chorus hits, the kick + the
width + the resolved harmony all return at once. If the
pre-chorus and chorus have the same density, the chorus has nothing
to contrast against.

## Step 6 — Density mapping by element

For each section, list which of these are active:

- Kick, snare, hat, perc, ride/crash
- Bass (sub, mid, both)
- Pads, keys, plucked instruments
- Lead vocal, background vocals, ad-libs
- FX (risers, impacts, reverse, vinyl crackle)

Aim for a *visible* density change between adjacent sections.
Verses around 5–8 active elements, choruses around 10–14, bridges
often around 4–6 (strip down before the final lift).

## Step 7 — The 30-second test

Could a listener identify the song from any random 30-second slice?
If two sections sound interchangeable, one of them is redundant.
Either differentiate or cut.

## Step 8 — The one or two notes

Don't dump a 14-point arrangement overhaul. Pick the *one* change
that unblocks the most downstream value:

- Move the chorus 8 bars earlier
- Cut the second verse in half
- Drop the kick under the second pre-chorus
- Add a half-time bridge

Frame it as a hypothesis to A/B, not a verdict. The artist tries
the change, listens, decides.

## Output

Emit a `:::artifact` block containing:

- The section map with bar counts
- The energy-curve scores per section
- The tension/release pairs you found
- The one or two suggested changes, framed as A/B hypotheses
- Reference tracks (2–3) with similar form for comparison
