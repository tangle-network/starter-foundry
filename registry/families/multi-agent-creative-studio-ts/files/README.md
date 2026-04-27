# multi-agent-creative-studio

Curated 4-role creative studio. Cross-medium creative collaboration for
projects that span music, script, prose, and visual.

## What this bundle is

A coordinated team of four creative-craft agents:

- **music-producer** — arrangement-review, mix-feedback,
  needle-drop suggestions
- **screenwriter** — beat-out, logline-sharpener, scene-rewrite-pass
- **novelist-coach** — scene-card system, voice-audit
- **illustrator** — composition-canvas, storyboard-protocol,
  color-palette-design

Plus the orchestrator's `AGENTS.md` (with a `## Coordination`
section folding the four-rule protocol — artist-always-wins,
cross-medium handoffs, lead-artist style coherence, no-rewrite —
into the system prompt) that defines how the roles hand work to one
another when a project spans mediums.

## How a sandbox spawns it

The Tangle sandbox sidecar reads `agents.json` (OpenCode-native
subagent registry) to enumerate the four roles. Each subagent's
inline `prompt` field is the full text of its
`roles/<role>/AGENTS.md`. The orchestrator's `AGENTS.md` is the
team-level system prompt — its `## Coordination` section is the
source of truth for the four studio rules. Routing between roles
happens via `:::handoff` blocks emitted by one role and consumed
by the host (the host then dispatches to the named subagent).

This is a markdown + JSON bundle; no `pnpm build` step. It composes
on top of `agent-base:tangle`, `agent-base:secure`, `agent-output:blocks`,
and `agent-tools:phony-voice` (the music-producer is voice-capable).

## The differentiator: cross-medium handoffs

A single-role bundle is enough for single-medium work. The studio
exists for the moments when one medium creates work in another:

- screenwriter writes a needle-drop placeholder → music-producer
- illustrator draws a panel that reframes the action → screenwriter
- novelist drafts a cinematic scene → screenwriter (adaptation pass)
- music-producer hears a tonal conflict in the scripted scene →
  screenwriter

The `## Coordination` section of `AGENTS.md` defines the four
rules:

1. **Artist always wins** — agents propose, never override.
2. **Cross-medium handoffs** — explicit `:::handoff` blocks with
   scene/page/track anchors, six concrete examples documented.
3. **Style coherence** — lead artist (the role that started the
   project) sets style; others propose alignment.
4. **No-rewrite rule** — agents never rewrite the artist's text,
   notes, score, or sketches. They suggest. The artist disposes.

## Domain capabilities

Twelve declared capabilities across the four roles plus the
cross-medium-handoff capability. See
`defaults.declaredCapabilities` in `manifest.json`.

## Extension points

- `roles/<role>/methodology/` — add a methodology file, register it
  in the role's `AGENTS.md` (under "Authoritative skills"). The
  inline `prompt` in `agents.json` mirrors the role's `AGENTS.md`,
  so regenerate after edits.
- `AGENTS.md` (`## Coordination`) — additional handoff examples
  and edge cases as the studio's vocabulary grows.
- `agents.json` — add a fifth role (cinematographer-coach,
  poet-coach, etc.) by extending the registry + dropping in a
  `roles/<new-role>/` tree mirroring the existing four.

## What this bundle is NOT

- Not a substitute for an actual studio team (real producer, real DP,
  real editor). The agents propose; the artist hires.
- Not a final-asset pipeline (no rendered audio, no rendered video,
  no published manuscript). Roles produce craft notes, scene cards,
  storyboard briefs — preparation, not deliverables.
- Not a mastering engineer / branding agency / IP lawyer. The roles
  emit `:::escalation` blocks when a request crosses those lines.
