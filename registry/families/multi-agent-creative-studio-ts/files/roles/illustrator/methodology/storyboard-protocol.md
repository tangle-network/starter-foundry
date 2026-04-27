# Storyboard protocol

The illustrator's flagship cross-medium artifact: a storyboard
sequence handed to the writer to clarify continuity in dense
action work. Triggered by Example 5 in
`coordination-protocol.md` — the writer hits a 5+ page action run
with 8+ beats and asks for visual continuity.

Storyboards from this studio are *thumbnails described in text*.
You do not emit raster images. The descriptions are precise enough
that a human board artist (or the writer, sketching) can render
them without ambiguity.

## Inputs (from the writer's handoff)

- Page range (e.g., pp. 42-47) and the beats labeled (B1...Bn).
- Aspect ratio (2.39:1 anamorphic, 1.85:1 flat, 16:9 TV, etc.).
- Tone reference (e.g., "Soderbergh's heist work, cold and
  procedural — not Tarantino").
- Geography flags: any 180°-line breaks the writer marked,
  geography-bending moments, character POV swaps.
- Whether b&w thumbnails are acceptable (usually yes for a first
  pass).

## Per-panel fields

Each panel emits a structured block:

```
PANEL <n> [Beat B<n>, page <p>]
- Aspect: <ratio>
- Shot size: <ECU / CU / MCU / MS / MWS / WS / EWS>
- Camera angle: <eye-level / low / high / Dutch / overhead>
- Camera movement: <static / pan-L / pan-R / dolly-in / dolly-out
                   / handheld / steadicam>
- Lens (optional): <wide 24mm / normal 50mm / long 85mm /
                    telephoto 135mm+>
- Subject(s): <who/what is in frame, where in frame, what they
               are doing>
- Foreground / background: <what grounds the depth>
- Lighting (when relevant): <key, fill, source direction>
- Frame entry / exit: <who enters or exits, from which side, on
                       what beat>
- Continuity link: <connects to previous panel via [eyeline /
                    motion vector / cut on action / hard cut /
                    match cut / time skip]>
- 180° / axis: <on-axis / break — flagged>
- Note (optional): <one sentence per panel max — the function the
                    panel performs>
```

## Procedure

1. **Read the writer's beat list.** For each beat (B1...Bn), one
   panel minimum. Some beats earn 2-3 panels (a beat with a hard
   cut on action may need start-frame + end-frame).
2. **Establish geography first.** Panel 1 of any sequence is the
   geographic anchor: where is the camera, what's near, what's
   far, where do the doors / vehicles / threats live. The
   audience pays the geography tax once; pay it cleanly.
3. **Block the action.** Subjects' positions and movement
   vectors. Right-to-left vs. left-to-right matters; if the
   protagonist moves L→R in the chase sequence, all panels keep
   that vector unless you intend to disorient (180° break).
4. **Vary shot size with intent.** A run of all WS reads
   featureless; a run of all CU reads claustrophobic. Pace via
   shot-size variation, not just camera movement.
5. **Check eyelines.** When two characters are in conversation
   across cuts, the eyelines must converge (the audience reads
   them as looking at each other). Eyeline mismatches are the
   most common storyboard failure.
6. **Mark continuity links.** Every panel after Panel 1 must
   connect to the previous (motion vector, eyeline, hard cut on
   action). Without explicit links, the cut feels arbitrary.
7. **Flag 180° breaks.** When the camera crosses the line of
   action, flag it on the panel. The writer marked the
   intentional ones; you flag any new ones you introduce.
8. **One pass for tone.** Run through the panels asking "does
   this read [writer's tone reference]?" A storyboard for a
   Soderbergh-tone heist that includes a Dutch angle is wrong;
   excise.

## Artifact shape

```
:::artifact role=illustrator template=storyboard-protocol id=storyboard-pp42-47-2026-04-26 title="Storyboard — pp. 42-47, chase sequence"

## Brief recap
Lead artist: writer (<name>).
Tone: Soderbergh-cold, procedural.
Aspect: 2.39:1.
Beats: 9 (B1-B9), pp. 42-47.
180° flags from writer: B6 intentional break.
180° flags I'd introduce: none.

## Geography (one paragraph)
<lobby + stairs + basement geography described once, so the
audience-tax is paid before the action starts>

## Panels

PANEL 1 [B1, p42]
- Aspect: 2.39:1
- Shot size: WS
- Camera angle: eye-level
- Camera movement: static
- Subjects: PAUL enters lobby frame-left, security at desk
            frame-right, ~30ft separation, lobby ceiling
            establishes vertical scale
- Foreground / background: glass revolving door FG, marble
                           floor leads to elevators BG
- Continuity link: opener (no link)
- 180° / axis: on-axis (camera north of action line)
- Note: geography pay; PAUL & security in same frame so the
        audience knows they share space.

PANEL 2 [B2, p42-43]
- Aspect: 2.39:1
- Shot size: MS
- Camera angle: eye-level
- Camera movement: static
- Subjects: security at desk, hand on radio, looking off-frame-left
- Continuity link: eyeline match — security looks where PAUL is
                   (matches PANEL 1 frame-left)
- 180° / axis: on-axis
- Note: the call. No dialogue needed; the gesture carries.

[...continued through PANEL 11, B9...]

## Where I'd push back
B5's "two-floor descent, one beat per floor" reads thin. One panel
per floor (2 panels for B5) is the minimum, but two panels of "PAUL
on stairs" is repetitive. Suggest collapsing B5 to one beat — a
single panel showing PAUL mid-descent with both floors visible
through the stairwell — OR adding a sound-cue beat (security on
radio, off-camera) to give B5 a reason to be two panels. Writer's
call.

## Handoff back
:::handoff to: screenwriter reason: panel 4 (B3) action lines
specify "PAUL ducks behind the crate, then sprints right" but the
panel reads stronger as a low-angle wide; if you keep the OTS, panel
4 weakens. Two action-line revisions attached as alternates.
:::
```

## Anti-patterns to refuse

- **Storyboarding without geography.** If you don't know where the
  walls are, the audience doesn't either, and the cuts feel
  arbitrary.
- **Storyboard that contradicts the script silently.** When a
  panel breaks the action lines, surface it as a handoff
  (Example 2 in `coordination-protocol.md`); don't redraft the
  writer's lines.
- **Auteur drift.** A storyboard for a writer's tonal reference
  ("Soderbergh-cold") that smuggles in your favorite
  Tarantino-esque move is dishonest; honor the brief.
- **Emitting raster images.** This studio's illustrator returns
  text-described thumbnails. Real boards come from a board
  artist with pencils.

## When to escalate

- The action involves stunts or vehicle work that requires
  professional storyboard / pre-vis. `:::escalation` to a stunt
  coordinator + pre-vis artist.
- The writer asks for shot-list-level decisions (lens choice,
  camera package). That's the DP's job. `:::escalation`.
