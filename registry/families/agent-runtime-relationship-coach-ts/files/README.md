# relationship-coach

Voice-first relationship coaching agent bundle. **Not a licensed
couples therapist. Not a substitute for individual therapy. Not a
substitute for DV safety planning.** Peer-style coaching on
communication, patterns, and boundaries — with a mandatory,
non-negotiable escalation protocol for domestic-violence, abuse,
self-harm, and clinical-replacement triggers.

## What this bundle is

An agent's filesystem: a system prompt + check-in / communication-
tool / pattern-naming templates + Cloudflare Worker shell + Tangle
Sandbox SDK + `@ph0ny/sdk` for voice. Runs in a per-user Tangle
sandbox; LLM calls go through `router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. By default the agent runs the check-in protocol
   (`templates/check-in-protocol.md`).
4. Communication-tool or pattern-naming templates load on user
   request.
5. Any escalation trigger (DV, abuse, self-harm, coercive-control,
   substance crisis, clinical-replacement) routes to
   `:::escalation` output and the relevant hotline.

## Domain capabilities

- `check-in-protocol` — daily / weekly check-in flow with brief
  safety check; methodology in
  `templates/check-in-protocol.md`.
- `communication-tool-practice` — Gottman softened-startup, NVC
  observation/feeling/need/request, repair attempts, validation-
  without-agreement; methodology in
  `templates/communication-tool-practice.md`.
- `conflict-pattern-naming` — name common dynamics (pursue-withdraw,
  four-horsemen, gridlock-vs-solvable, attachment-style framing)
  WITHOUT diagnosing the partner; methodology in
  `templates/conflict-pattern-naming.md`.

## DV / abuse / crisis protocol

Mandatory and unconditional. The escalation block fires for any of
the following — the bundle does not "finish the coaching turn
first":

- Physical violence, threats, weapon access, choking / strangulation,
  sexual coercion, stalking → **National Domestic Violence Hotline
  1-800-799-7233**, text START to 88788, https://www.thehotline.org;
  + **RAINN 1-800-656-HOPE** (https://www.rainn.org) for sexual
  assault.
- Self-harm or suicidal ideation → **988 Suicide & Crisis Lifeline**
  (call or text 988).
- Child / elder / vulnerable-adult abuse → **Childhelp
  1-800-422-4453** / **Eldercare Locator 1-800-677-1116**;
  jurisdictional reporting rules vary.
- Substance-use crisis → **SAMHSA 1-800-662-HELP** (free,
  confidential, 24/7).
- Pregnancy + abuse → enhanced DV escalation; NDVH knows this
  routing.

The bundle never advises stay-or-leave in DV; that decision is the
user's own, made with a trained DV advocate.

## Voice mode

When deployed with the `agent-tools/phony-voice` layer stacked, the
bundle exposes voice STT/TTS via `@ph0ny/sdk` (the only public phony
package). Internal phony packages are NOT shipped in this bundle.

## Extension Points

- `system-prompt.md` — adjust role / refusal rules / output blocks.
  Re-run `prompt-frontmatter-valid` after edits. **Never weaken the
  escalation triggers — they are load-bearing.**
- `templates/check-in-protocol.md` — refine check-in cadence and
  safety-check phrasing.
- `templates/communication-tool-practice.md` — extend with other
  evidence-based frameworks (EFT, Imago) only with citations.
- `templates/conflict-pattern-naming.md` — add culturally-informed
  dynamics; never add diagnostic labels.
- `defaults.crisisHotlines` (in manifest) — override regional
  hotline numbers (Refuge UK / 1800RESPECT AU / etc.) for non-US
  deployments.
- `defaults.allowedDomains` — additional outbound URLs the bundle
  is permitted to reach. Anything outside this list is sandbox-
  blocked.
