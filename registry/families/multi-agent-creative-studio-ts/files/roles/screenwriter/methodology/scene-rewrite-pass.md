# Scene rewrite pass

A scene works when something *changes* between page 1 and page N
of it. The change is the spine. Every beat either pulls toward the
change or it's dragging.

## Pass 1 — find the spine

Ask the writer:

1. What does each character WANT in this scene?
2. What CHANGES between the start and end?
3. If you cut this scene, what would the next scene have to do?

If question 3 has the answer "nothing" — cut the scene.

## Pass 2 — beat audit

Read the scene line by line. For each beat (each shift in topic /
action / pressure), ask:

- Does this beat advance the spine?
- Is it specific (action / image) or generic (statement)?
- Is it earning its line count?

Beats that don't advance get cut. Beats that are generic get made
specific. Beats that take 8 lines to do what could be done in 2
get trimmed.

## Pass 3 — dialogue

- **Cut the warmups.** Most scenes can lose the first 3 lines.
- **Cut the "as-you-knows".** If two characters explain things to
  each other for the audience's benefit, find another delivery
  mechanism.
- **Make subtext.** What is each character NOT saying? If both
  characters are saying everything they think, you have a draft
  problem.
- **Voice ≠ accent.** Voice is rhythm + word choice + what they
  notice. Don't write "phonetic" dialect; trust the actor.

## Pass 4 — action lines

- Present tense, declarative. "Jane pours coffee." Not "Jane is
  pouring coffee."
- Concrete images, not adjectives. "The mug is chipped." Not "The
  mug looks weathered and old."
- One thought per paragraph. White space is your friend.
- Don't direct camera unless you're a director-writer with that
  authority.

## Pass 5 — read it cold

Print it. Read it aloud. Where you stumble, the page stumbles.
Where you're bored, the audience is bored.

## Cross-medium pass — handoff opportunities

A scene rewrite is the natural moment to surface cross-medium
handoffs the beat-out flagged. For each scene:

- **Music cue / needle-drop.** Did the beat-out log a music
  placeholder for this scene? If so, draft the brief now (window,
  diegesis, function, tonal direction) and emit
  `:::handoff to: music-producer` (Example 1 in
  `coordination-protocol.md`). Doing it during the rewrite means
  the producer's response can inform the *next* draft of the
  scene.
- **Storyboard.** If this scene is part of a 5+ page action run
  with 8+ beats, hand off to the illustrator now (Example 5).
  Tone reference + aspect ratio + 180°-line flags. Storyboards
  during rewrite often expose action-line problems before the
  writer commits to them.
- **Adaptation source.** If this scene is adapted from a
  novelist-coach-handoff, do a fidelity-check pass: does the
  rewritten scene preserve the source's value-shift? If you've
  drifted, surface to the coach for a read.

The handoffs do not block the rewrite. They run in parallel; the
writer keeps drafting while the producer / illustrator / coach
respond.

## When to leave it alone

Polish has a stopping point. After three passes, if a beat still
isn't working, the problem is structural — go back to the
beat-out. Don't keep rewriting a scene that the structure won't
support.

## What goes in the artifact

```
:::artifact role=screenwriter template=scene-rewrite-pass id=scene-rewrite-2026-04-26 title="Scene rewrite — <slug>, page <N>"

## The spine (one sentence)
<what changes between page 1 and page N>

## The audit
- Beat 1 (lines 1-12): <verdict — keep / cut / specific-up / trim>
- Beat 2 (lines 13-28): ...
- ...

## Top three line edits (suggestions)
1. <line + replacement + craft principle>
2. ...
3. ...

## Cross-medium opportunities
- :::handoff to: music-producer reason: <if applicable>
- :::handoff to: illustrator reason: <if applicable>

## Read-cold notes
<places I stumbled / got bored when reading aloud>
:::
```

## Anti-patterns to refuse

- Rewriting the writer's pages and presenting them as "fixed."
  Suggestions only. The writer rewrites (Rule 4).
- Polishing a scene the structure won't support. Three passes max,
  then back to beat-out.
- Forcing every scene to have a clean value-shift. Some scenes
  *are* connective tissue, and forcing them to "do work" kills
  rhythm.
