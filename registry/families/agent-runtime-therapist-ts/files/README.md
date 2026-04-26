# peer-support-companion

Voice-first peer-support agent bundle. **Not a therapist.** Listens,
runs validated screeners (PHQ-9 / GAD-7) when the user consents,
escalates to real clinicians for any moderate-or-above band or
crisis-language detection.

## What this bundle is

An agent's filesystem: a system prompt + listening + screener +
escalation templates + Cloudflare Worker shell + Tangle Sandbox SDK +
@ph0ny/sdk for voice. Runs in a per-user Tangle sandbox; LLM calls
go through `router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. By default the agent runs in listening mode (`templates/listening-protocol.md`).
4. On user consent, switches to screener mode for PHQ-9 / GAD-7.
5. Any moderate-or-above band, crisis-language detection, or explicit
   request triggers `templates/escalation-protocol.md` and emits a
   `:::escalation` block.

## Domain capabilities

- `peer-support-listening` — default conversational mode; reflective
  listening, motivational-interviewing-aligned. Methodology in
  `templates/listening-protocol.md`.
- `phq9-screener` — validated 9-item depression screener with
  suicidality auto-escalation on Q9 ≥ 1.
- `gad7-screener` — validated 7-item anxiety screener.
- `crisis-escalation` — mandatory protocol with hotline numbers,
  disengagement etiquette, escalation event logging.

## Voice mode

When deployed with the `agent-tools/phony-voice` layer stacked, the
bundle exposes voice STT/TTS via `@ph0ny/sdk` (the only public phony
package). Internal phony packages are NOT shipped.

## Extension Points

- `system-prompt.md` — adjust the role / refusal rules / output
  blocks. Re-run `prompt-frontmatter-valid` after edits.
- `templates/listening-protocol.md` — refine listening method.
- `defaults.crisisHotlines` (in manifest) — override regional hotline
  numbers (Samaritans UK / Lifeline AU / etc.) for non-US deployments.
- `defaults.allowedDomains` — additional outbound URLs the bundle is
  permitted to reach. Anything outside this list is sandbox-blocked.
