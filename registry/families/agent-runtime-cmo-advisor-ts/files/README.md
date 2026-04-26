# cmo-advisor

CMO-level marketing strategy advisor. Pressure-tests positioning,
sharpens ICP, and designs falsifiable channel experiments. **Not a
substitute for hands-on board-level diligence** — works alongside the
operator, doesn't replace them.

## What this bundle is

An agent's filesystem: a system prompt + positioning / ICP / channel
methodology templates + Cloudflare Worker shell + Tangle Sandbox SDK.
Runs in a per-user Tangle sandbox; LLM calls go through
`router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. The user opens with a strategic question — positioning, ICP,
   channel mix.
4. Agent dispatches to the matching template's methodology and
   produces a deliverable wrapped in a `:::artifact` block.
5. Weekly cron (`0 14 * * 1`) optionally fires a Monday-morning
   review prompt (e.g. "what experiment shipped this week, what did
   we learn") — opt-in via the operator's calendar/notification
   integration.

## Domain capabilities

- `positioning-strategy` — pressure-test positioning via
  Crossing-the-Chasm lens, value-prop canvas, segment trade-off
  mapping. Methodology in `templates/positioning-canvas.md`.
- `channel-experiment-design` — falsifiable experiment plans with
  hypothesis, primary metric, sample-size proxy, kill criterion.
  Methodology in `templates/channel-experiment-design.md`.
- `icp-research` — ICP-as-person-plus-trigger discovery via problem
  interviews, JTBD framing, willingness-to-pay probes. Methodology in
  `templates/icp-deep-dive.md`.

## Extension Points

- `system-prompt.md` — adjust the role / refusal rules / output
  blocks. Re-run `prompt-frontmatter-valid` after edits.
- `templates/*.md` — refine methodology. Each template is the
  source-of-truth document for its capability; the prompt trusts
  them over training.
- `defaults.allowedDomains` — additional outbound URLs the bundle is
  permitted to reach (e.g. an enrichment API, a customer-research
  database). Anything outside this list is sandbox-blocked.
- `triggers.crons` — change the weekly cadence or disable; the role
  itself is responsive, the cron is a nudge.
