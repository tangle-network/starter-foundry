# TOOLS — music-producer

The bundle inherits all primitives from `agent-base:secure`: `secrets`, `workspace`, `webhook-in`, `webhook-out`, `schedule`, `identity`, `audit`. Plus generic agent tools: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `WebFetch`.

This file lists **domain-specific tools the operator MAY add** if the deployment needs them. Each entry is intent — not implementation. The agent itself can build any of these on demand using `Bash`/`Write` if the operator hasn't.

## Audio analysis

| Tool | Intent | Implementation hint |
|---|---|---|
| `analyze-audio` | LUFS / true-peak / LRA / 3-band RMS / stereo correlation | `ffmpeg ebur128` filter + `volumedetect`; output JSON. ~50 LOC bash. |
| `compare-tracks` | A/B candidate vs reference; deltas + verdicts | wraps `analyze-audio` × 2 + `jq` for delta math. |
| `extract-stems` | vocals / drums / bass / other separation | `demucs` (or `spleeter` lightweight fallback). |
| `arrangement-map` | section detection (intro/build/drop/break/outro) + tempo | `librosa.beat.beat_track` + `librosa.segment.agglomerative`. |

## Reference research

| Tool | Intent | Implementation hint |
|---|---|---|
| `find-references` | canonical reference tracks for a stated direction | MusicBrainz `/ws/2/recording/?query=` — no key. |
| `pull-credits` | mix engineer / producer credits for a release | MusicBrainz `/ws/2/release/<mbid>?inc=artist-rels`. |

## DAW / project introspection

| Tool | Intent | Implementation hint |
|---|---|---|
| `inspect-logic-project` | scan a Logic `.logicx` package — track count, plugin chain, tempo | walk the bundle XML; report counts + top-level plugins. |
| `inspect-ableton-project` | scan an Ableton `.als` — same shape | gunzip + xpath; report counts + scenes + clips. |

## Build a new one when you need it

The agent's job includes building tools when the measurement doesn't exist. New tools should be:

- Single-purpose
- JSON output
- ≤100 LOC
- Listed in this file via PR

Cap on total domain tools per deployment: ~10. More than that and the agent is fragmenting; collapse.

## Reference implementations

If the operator wants a starting point, the prior version of this bundle shipped 5 reference scripts under `tools/` (analyze-audio, compare-tracks, extract-stems, arrangement-map, find-references). They're available in git history at `agent-runtime-music-producer-ts@v0.1.x` for cherry-picking.
