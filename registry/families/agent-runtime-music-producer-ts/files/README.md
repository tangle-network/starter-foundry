# music-producer

Voice-first creative music-producer agent bundle. **Collaborator, not
override.** Listens first, reflects what it heard, then suggests one
or two practical next moves on arrangement, mix, or mastering — and
gets out of the artist's way.

## What this bundle is

An agent's filesystem: a system prompt + arrangement-review +
mix-feedback + weekly-listening templates + Cloudflare Worker shell +
Tangle Sandbox SDK + `@ph0ny/sdk` for voice. Runs in a per-user
Tangle sandbox; LLM calls go through `router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. By default the agent runs in listening mode — asks the artist
   what they're working on, what they've already tried, what they
   want.
4. On the artist's prompt it switches to `arrangement-review` or
   `mix-feedback`, loading the matching template as the methodology
   source of truth.
5. The daily cron (`0 16 * * *`, afternoon listening prompt) emits
   the `weekly-listening-prompt` flow — picks reference tracks across
   genres and invites a voice-dictation listening log.

## Domain capabilities

- `arrangement-review` — section structure, tension/release,
  density mapping, energy curve, contrast principle. Methodology in
  `templates/arrangement-review.md`.
- `mix-feedback` — reference-track A/B, frequency masking, dynamic
  range / LUFS targets, stereo-field analysis, common pathologies.
  Methodology in `templates/mix-feedback-protocol.md`.
- `weekly-listening-protocol` — cron-driven listening practice;
  picks 3 reference tracks, invites voice-dictation listening notes,
  captures as `:::artifact`.

## Voice mode

When deployed with the `agent-tools/phony-voice` layer stacked, the
bundle exposes voice STT/TTS via `@ph0ny/sdk` (the only public phony
package). Voice mode is the *intended* operating mode — the artist
stays at the DAW, dictates listening notes, gets responses through
their monitors. Internal phony packages are NOT shipped.

## Extension Points

- `system-prompt.md` — adjust the role / refusal rules / output
  blocks. Re-run `prompt-frontmatter-valid` after edits.
- `templates/arrangement-review.md` — refine arrangement-review
  methodology (e.g. add a beat-grid analysis step for hip-hop).
- `templates/mix-feedback-protocol.md` — refine mix methodology
  (e.g. swap streaming LUFS targets for vinyl-aware values).
- `defaults.allowedDomains` — additional outbound URLs the bundle
  is permitted to reach (e.g. a reference-track service). Anything
  outside this list is sandbox-blocked.
