# fitness-coach

Voice-first personal fitness coach agent bundle. **General strength
and conditioning only — not a licensed PT, not a doctor, not a
registered dietitian.** Programs healthy adult lifters, cues
technique, and manages recovery. Anything clinical (pain, rehab,
return-from-injury, pediatric, pregnancy, eating-disorder signals)
is escalated to the right professional.

## What this bundle is

An agent's filesystem: a system prompt + weekly-program + form-check
+ deload templates + Cloudflare Worker shell + Tangle Sandbox SDK +
@ph0ny/sdk for voice. Runs in a per-user Tangle sandbox; LLM calls
go through `router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. Daily afternoon cron (`0 14 * * *`) triggers the check-in flow —
   "how did yesterday's session go, what's on for today, any flags."
4. On request, the agent loads the matching template
   (`weekly-program`, `form-check-protocol`, or `deload-prompt`)
   and produces a `:::artifact` block.
5. Any clinical / refusal trigger short-circuits to the escalation
   block. The agent does not program around it.

## Domain capabilities

- `weekly-program` — training-age-aware weekly split with volume
  landmarks (MEV / MAV / MRV per muscle group), RPE/RIR-based load
  selection, progressive-overload progression rules. Methodology in
  `templates/weekly-program.md`.
- `form-check-protocol` — five-point technique review per major lift
  with red-flag list and refer-out criteria. Methodology in
  `templates/form-check-protocol.md`.
- `deload-prompt` — recognition signs, three deload styles
  (volume-cut / intensity-cut / full rest), and the de-deload return
  protocol. Methodology in `templates/deload-prompt.md`.

## Voice mode

When deployed with the `agent-tools/phony-voice` layer stacked, the
bundle exposes voice STT/TTS via `@ph0ny/sdk` (the only public phony
package). Internal phony packages are NOT shipped. Voice mode is the
default delivery channel for cues during sessions — short
external-focus prompts between sets, hands-free dictation of the
session log.

## Clinical / non-clinical boundary

This bundle is deliberately scoped to **healthy adult general
fitness**. The system prompt enforces this with mandatory escalation
triggers (non-DOMS pain, return-from-injury, pediatric, geriatric
with comorbidities, pregnancy, eating-disorder signals) and hard
refusals (extreme cuts, PED cycles, anything diagnostic). Operators
deploying into clinical contexts (PT clinics, hospital wellness
programs) MUST stack a clinically-credentialed layer; this bundle
is not it.

## Extension Points

- `system-prompt.md` — adjust role / refusal rules / output blocks.
  Re-run `prompt-frontmatter-valid` after edits.
- `templates/weekly-program.md` — refine the volume / progression
  model (e.g. for a powerlifting-only deployment, swap hypertrophy
  landmarks for strength-block percentages).
- `templates/form-check-protocol.md` — extend the lift list past
  squat / bench / deadlift / OHP / row to e.g. olympic lifts (with
  a credentialed-coach disclaimer added).
- `templates/deload-prompt.md` — tune the recognition-signal
  thresholds and the de-deload return curve.
- `defaults.allowedDomains` — additional outbound URLs the bundle is
  permitted to reach. Anything outside this list is sandbox-blocked.
