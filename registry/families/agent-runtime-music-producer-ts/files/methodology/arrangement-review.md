# arrangement-review

A pass on the *structure* of a track — section flow, energy curve, density. Mix-feedback's parent: if the arrangement is wrong, no amount of EQ saves it.

## Inputs

- The candidate track at any stage (demo, full mix — even a vocal-and-piano sketch)
- Optional: 1-2 references that exemplify the structural shape the artist is going for

## Procedure

```
# 1. Get the timeline
tools/arrangement-map.py candidate.wav
# → returns tempo + sections [{start, end, label, rms}]

# 2. Plot the energy curve (mental, from the rms field)
# Look for: where does energy peak? where does it drop? does the
# "drop" land where the structure says it should?

# 3. If references were named, map those too
tools/arrangement-map.py reference-1.wav

# 4. Compare structural shapes
# - Where do their drops land relative to track length?
# - How long is the intro vs the build?
# - Is there a break before the final chorus?
```

## What you're listening for

| Signal | Question |
|---|---|
| **Section duration** | Is the intro long enough to commit, short enough to not bore? Reference: 8-16 bars typical for pop/electronic; 1-4 bars for streaming-era. |
| **Energy curve** | Does it climb? Does it bottom out before the final lift? A flat curve is the #1 cause of "this just sits there." |
| **Contrast** | Does the loudest section feel loud *because the quietest section was quiet*? Or did you compress the dynamic range out of it? |
| **Density change** | When the chorus hits, does the *number* of elements change, or just their volume? Density change is what the listener actually perceives. |
| **Surprise** | Where is one moment that does something the listener didn't predict? Without it, the track is a checklist. |

## What goes in the `:::artifact`

Two patterns work, depending on stage:

### Pattern 1 — early-stage (sketch / demo)

```
:::artifact id=arrangement-2026-04-26 title="Arrangement notes — track-3-demo"

## Section map
0:00 - 0:16  intro       [low energy, piano + pad]
0:16 - 0:48  verse       [+vocals, beat doubles]
0:48 - 1:16  pre-chorus  [+bass, build]
1:16 - 1:48  chorus      [full kit, vocals double-tracked]
1:48 - 2:20  verse 2     [drop pad, vocal forward]
2:20 - 2:52  chorus 2    [same as ch1]
...

## The structural call
The two choruses are identical. That's the hole. In your reference
[X], chorus 1 is full-kit, chorus 2 drops the kick for 4 bars then
slams back in — that's the moment that makes the track land. Try:
move kick out 2:20 → 2:36, return it 2:36 with everything.

## Optional
Intro might be 4 bars too long for streaming retention. Cut the
first 8 seconds and start from "verse 1 lite."
:::
```

### Pattern 2 — near-final

Tight notes only. The structure is mostly settled; you're checking that the energy curve resolves and there's at least one surprise. One artifact, max two notes.

## Anti-patterns to refuse

- Imposing a Save-the-Cat-style template on an artist whose direction is something else (lyric novel, slice-of-life electronica). Use frameworks as diagnostic, not contract.
- Calling for a "drop" in a track that doesn't want one. Some songs are arc-less by design.
- Restructuring without listening to the reference the artist named — taste imposition, not collaboration.

## When to build a new tool

- "I want to know where the chorus *actually* hits relative to where the energy peaks" — write a script that returns that delta in seconds. Ship it under `tools/`, JSON output. Use it.
- "Is the third chorus really louder, or just more compressed?" — write a tool that returns peak vs RMS per section and lets you see the lie. Ship it.
