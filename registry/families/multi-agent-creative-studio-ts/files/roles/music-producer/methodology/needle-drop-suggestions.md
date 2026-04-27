# needle-drop-suggestions

A cross-medium methodology: the screenwriter has handed off a scene
that needs a song. Your job is to surface three candidates with
license posture and the tonal argument behind each — *not* to pick
one. The writer (and ultimately the music supervisor / showrunner)
picks. You make the choice legible.

This methodology is the studio's flagship cross-medium handoff
artifact. Treat it that way.

## Inputs

- The scripted scene (or a paraphrase that names: location, action,
  character POV, dialogue density, scene length, the *function* the
  song should perform).
- The writer's tonal direction (e.g., "Phoebe Bridgers / early Bon
  Iver / Big Thief late-album cuts; should *contradict* the relief
  the audience expects").
- Diegesis posture: in-world (radio, jukebox, character plays it)
  vs. score (outside the world). License implications differ.
- Production context if known: budget tier (indie / studio), sync
  budget, era constraints (period film), territory restrictions.

## Procedure

```
# 1. Read the scene. Note the function the song should perform —
#    underline (echo the emotion), counter (contradict the picture),
#    or carry (the song does what the dialogue won't).

# 2. Surface 5-7 candidates that match the writer's tonal references.
tools/find-references.sh "<tonal direction>"

# 3. For each candidate, fingerprint:
tools/analyze-audio.sh candidate.wav
# → tempo, key, LUFS, LRA, length, in-point energy

# 4. Cross-check each against the scene's window (length match,
#    in-point alignment with a script beat, mid-range for dialogue).

# 5. Cut to three. The third is the "wildcard" — the unobvious pick
#    that might be wrong but might be the moment.

# 6. For each: license posture (commercial sync availability, era
#    of release, label complexity). Posture, not legal advice.
```

## What goes in the `:::artifact`

```
:::artifact role=music-producer template=needle-drop-suggestions id=needle-drop-scene14-2026-04-26 title="Needle-drop — Scene 14, INT. CAR — NIGHT"

## The brief (as I read it)
3-minute window, diegetic from the car radio. Tone: Bridgers / early
Bon Iver / Big Thief. Function: contradict the relief the audience
expects — the protagonist looks free; the song should feel like she
isn't.

## Candidate 1 — the safe pick
"Funny" — Phoebe Bridgers (Punisher, 2020)
Why it lands: minor-key acoustic, vocal-forward, melancholy under a
melodic surface. In-point at 0:00 is gentle pad + vocal, which lets
the radio feel real. 3:03 length matches the window. The lyric
(loneliness inside a relationship) under-textures the scene without
spelling it out.
Why it might miss: it's "the" Bridgers track right now; cliché risk
if your audience is media-literate.
Posture: major label sync (Dead Oceans). Available in commercial
sync libraries. Standard sync fee tier; not bargain.

## Candidate 2 — the honest pick
"Heavenly Father" — Bon Iver (Wish You Were Here OST, 2014)
Why it lands: written for picture, so it knows how to live under
dialogue. Sparse arrangement, mid-range cleared. The build at 1:40
gives you a beat to time the protagonist's gesture against. The
lyric is theological / abstract — won't compete with the dialogue.
Why it might miss: not a "radio-friendly" track for the diegesis if
the radio is supposed to be commercial top-40.
Posture: written-for-film, sync-clearable through Jagjaguwar. Mid
fee tier. Often available at festival rates.

## Candidate 3 — the wildcard
"Watching You Without Me" — Kate Bush (Hounds of Love, 1985)
Why it lands: the song is *about* presence-without-presence — the
exact emotional posture you described. It's haunted, off-rhythm,
and doesn't sound like a contemporary needle-drop. If your
protagonist is the kind of person who'd find this on a college
radio station, it grounds her.
Why it might miss: 1985 production; diegetic context has to make
sense (oldies radio, vintage aesthetic, etc.).
Posture: catalog-licensed through Fish People / Sony. Higher tier
fee for commercial sync. Often Bush's catalog is restricted; might
require direct artist approval.

## What I'd do (if you asked, which you didn't)
Candidate 2 is the cleanest fit. Candidate 3 is the moment-maker.
Candidate 1 is the safe ship. Pick on what your director / music
supervisor can live with at clearance time.

## Trade-off question for the writer
The candidates I shortlisted are *minor-key, melancholic*. Your
brief said "should feel like she isn't free." A more aggressive
read — angry, not melancholic — would point me at different
candidates (Mitski, Big Thief's louder cuts, late Lana Del Rey).
Confirm or redirect.

## Escalation
Final clearance is a music supervisor + IP lawyer call. I am not
either. :::escalation Music supervisor for sync budget + clearance,
IP lawyer for derivative-work questions if any.
:::
```

## When to push back vs. go with the brief

If the writer's tonal brief reads like it conflicts with the
scripted scene's emotional shape, do NOT silently substitute. Emit
a `:::handoff to: screenwriter` framing the conflict (Example 4 in
`coordination-protocol.md`). Three options laid out (the song is
wrong; the scene is wrong; the dissonance is the point). The writer
decides.

This is the one place the studio's coordination protocol is
load-bearing for music: a needle-drop that fights the picture
breaks both. Surfacing the conflict is the producer's job; resolving
it is the writer's.

## Anti-patterns to refuse

- Picking one. The output is three (or two + a wildcard). The
  writer / music supervisor picks. You make the choice legible.
- Committing to a track you haven't fingerprinted. If you didn't run
  the analysis, don't promise the in-point will work.
- Faking license posture. "Probably clearable" with no basis is
  worse than silence. If you don't know, say so and `:::escalation`.
- Reproducing copyrighted lyrics in the artifact. Reference titles,
  paraphrase function, do not paste lyrics.

## Hard refusals

- **No commercial-clearance promises.** That's the music
  supervisor's call.
- **No copyright/lyric reproduction.** Title + artist + album +
  year is fine; lyrics are not.
- **No silent re-direction.** If the writer's brief is wrong for the
  scene, surface the conflict, don't substitute.
