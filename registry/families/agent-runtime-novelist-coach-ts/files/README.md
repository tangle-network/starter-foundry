# novelist-coach

Creative novel-writing coach agent bundle. **Craft partner, not
override.** Reads first, reflects what it read, then offers one or
two practical moves on scene construction, beat structure, or voice
— and gets out of the writer's way.

## What this bundle is

An agent's filesystem: a system prompt + scene-card + beat-sheet +
voice-audit templates + Cloudflare Worker shell + Tangle Sandbox SDK.
Runs in a per-user Tangle sandbox; LLM calls go through
`router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement, plus
   `creativeCollaborator: true` and `overridesArtist: false` so the
   harness honors the artist-wins stance).
3. By default the agent runs in conversational mode — asks the
   writer what they're working on, what stage the draft is at, and
   whether they want feedback or just thinking-out-loud company.
4. On the writer's prompt it switches to `scene-card-protocol`,
   `beat-sheet-review`, or `voice-audit`, loading the matching
   template as the methodology source of truth.
5. The daily cron (`0 14 * * *`, afternoon writing prompt) emits a
   gentle nudge — a craft question, a scene-of-the-day prompt, or a
   reference passage — captured as a `:::artifact`.

## Domain capabilities

- `scene-card-protocol` — scene construction in the McKee /
  Dwight-Swain tradition: scene goal, conflict, value-shift,
  disaster, sequel beats. Methodology in
  `templates/scene-card-protocol.md`.
- `beat-sheet-review` — Save-the-Cat 15-beat and 8-sequence
  diagnostics with explicit guidance on when to deviate.
  Methodology in `templates/beat-sheet-review.md`.
- `voice-audit` — habitual-rhythm and filter-word diagnostics,
  passive-voice patterns, dialogue-tag overuse, head-hopping in
  close third, telling-vs-showing pass on a 500-word sample.
  Methodology in `templates/voice-audit.md`.

## Creative-collaborator stance

The bundle is built around one rule: **the writer's voice and intent
always win.** The frontmatter advertises `creativeCollaborator: true`
and `overridesArtist: false` so any host UI / orchestrator wrapping
this agent can render the stance correctly.

In practice that means the coach:

- Asks before suggesting. Default is conversation; edits are opt-in.
- Caps suggestions at three per pass — a wall of red is demoralizing
  and signals distrust.
- Will not insert prose into the manuscript without explicit
  per-session consent. Critique and diagrams are always fine; new
  sentences require an ask.
- Treats Save-the-Cat / 8-sequence frameworks as diagnostics, not
  contracts. The book is allowed to break the formula.

## Extension Points

- `system-prompt.md` — adjust the role / refusal rules / output
  blocks. Re-run `prompt-frontmatter-valid` after edits.
- `templates/scene-card-protocol.md` — refine scene-construction
  methodology (e.g. add a romance-genre scene-vs-sequel variation).
- `templates/beat-sheet-review.md` — refine beat-sheet methodology
  (e.g. swap Save-the-Cat for Hero's Journey on a mythic project).
- `templates/voice-audit.md` — refine voice-audit checks (e.g. add
  register-shift detection for dual-POV manuscripts).
- `defaults.allowedDomains` — additional outbound URLs the bundle
  is permitted to reach (e.g. a public-domain text corpus). Anything
  outside this list is sandbox-blocked.
