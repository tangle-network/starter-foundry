# language-tutor

Voice-first language tutor agent bundle. Krashen-aligned
comprehensible-input methodology + Anki-style spaced-repetition
vocabulary scheduling, calibrated to the learner's CEFR level.

## What this bundle is

An agent's filesystem: a system prompt + daily-conversation +
vocabulary-drill + shadowing templates + Cloudflare Worker shell +
Tangle Sandbox SDK + `@ph0ny/sdk` for voice. Runs in a per-user
Tangle sandbox; LLM calls go through `router.tangle.tools`.

## Supported languages

The default `targetLanguage` is Spanish (`es`). The bundle is
language-agnostic and ships ready for:

- `es` — Spanish (default)
- `ja` — Japanese
- `fr` — French
- `zh` — Mandarin Chinese

Adding a new target language is a one-line change — see
**Extension points** below. The methodology (i+1 input, recast
correction, SRS scheduling, shadowing) transfers across languages
unchanged.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` + `voiceFirst: true` for sandbox
   enforcement).
3. Daily cron (`0 13 * * *`, early afternoon local) fires the
   `daily-conversation-prompt` flow.
4. On user request, switches into vocabulary-drill or shadowing
   modes via the matching template.
5. Voice STT/TTS routes through the `agent-tools/phony-voice` layer
   (`@ph0ny/sdk`).

## Methodology stance

This tutor follows Stephen Krashen's **input hypothesis** and the
broader comprehensible-input tradition (Asher's TPR for embodied
practice, Anki / SuperMemo for SRS scheduling, shadowing for
prosody). Concretely:

- **i+1 input** — material one notch above current ability.
- **Output emerges, isn't extracted** — production is invited, never
  forced.
- **Recast over correction** — errors get modeled back in correct
  form, not lectured at.
- **Sparse, meaning-blocking-only correction** — over-correction
  raises affective filter and slows acquisition.
- **SRS for retention** — 1d / 3d / 7d / 14d / 30d / 90d intervals
  on `:::artifact` flashcards.

The bundle deliberately does *not* ship grammar-drill templates.
That's a methodology choice, not an oversight.

## Domain capabilities

- `daily-conversation-prompt` — cron-driven conversation prompt at
  the learner's CEFR level on a topic from their life. Voice mode
  primary. Methodology in `templates/daily-conversation-prompt.md`.
- `vocabulary-drill` — context-rich SRS drill pack with example
  sentences, cloze deletions, and recognition-vs-production
  asymmetry. Methodology in `templates/vocabulary-drill.md`.
- `shadowing-protocol` — three-stage shadowing practice (silent /
  slow / full-speed) with voice-mode prosody comparison.
  Methodology in `templates/shadowing-protocol.md`.

## Voice mode

When deployed with the `agent-tools/phony-voice` layer stacked, the
bundle exposes voice STT/TTS via `@ph0ny/sdk` (the only public phony
package). The daily conversation prompt and the shadowing protocol
are voice-mode primary — text fallbacks exist but the methodology is
designed around audio input/output. Internal phony packages are NOT
shipped.

## Extension points

- `defaults.targetLanguage` (in `manifest.json`) — change the
  target language. Set to `"ja"` for Japanese, `"fr"` for French,
  `"zh"` for Mandarin, or any ISO-639-1 code. The
  `TARGET_LANGUAGE` Worker var in `wrangler.toml` should mirror
  the same value so the runtime exposes it to the agent. The
  templates and system prompt do not hard-code Spanish — they
  reference "the target language" so the bundle adapts without
  template edits.
- `system-prompt.md` — adjust the role / pedagogical principles /
  output blocks. Re-run `prompt-frontmatter-valid` after edits.
- `templates/*.md` — refine the methodology per language family if
  needed (e.g. tonal-language pronunciation drills for Mandarin).
- `defaults.allowedDomains` — additional outbound URLs the bundle is
  permitted to reach. Anything outside this list is sandbox-blocked.
- `triggers.crons` — change the daily cron. Default is `0 13 * * *`
  (early afternoon UTC); per-learner timezone offsets belong at the
  cron-dispatch layer, not in the bundle.
