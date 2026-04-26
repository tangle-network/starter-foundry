# tax-prep-companion

Tax-prep agent bundle. Drafts filings, tracks deadlines, never substitutes
for a CPA. Operates inside a Tangle sandbox; LLM calls go through
`router.tangle.tools`.

## What this bundle is

An agent's filesystem: a system prompt + tax templates (Form 1040
methodology, deadline calendar, refusal protocol) + a Cloudflare Worker
shell with cron-driven deadline reminders. **Not a substitute for a CPA.**
The refusal protocol fires often by design.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content
2. Agent reads `system-prompt.md` (frontmatter declares `notCpa: true`,
   `circular230Notice: true`, `allowedDomains: [api.tangle.tools, irs.gov]`)
3. By default agent operates in drafting mode; switches to
   `templates/refusal-protocol.md` whenever the trigger list fires
4. `:::filing` and `:::deadline` blocks parsed by the host UI for typed
   render

## Domain capabilities

- `filing-drafting` — drafts Form 1040 with cited line items, opens
  `:::question` for missing inputs, never finalizes
- `deadline-tracking` — federal calendar (1040-ES, 1040, 1120, 1099,
  W-2, FBAR), per-user via D1 table; daily cron emits `:::deadline`
  blocks within 14 days of due
- `compliance-disclaimer` — Circular 230-aligned refusal protocol;
  fires on final-filing requests, disputed positions, legal-territory
  asks, federal-state conflicts, high-dollar amounts (>$50k swing)

## Out-of-scope by design

- State returns (template gives federal-only; state varies + changes)
- Audit defense (legal territory)
- Entity formation / estate planning (legal territory)
- Final filing (no signature authority)

## Extension Points

- `system-prompt.md` — adjust role / refusal triggers / output blocks
- `templates/filing-1040.md` — refresh tax-bracket numbers each year
  (re-run with current `retrieved` date)
- `templates/deadlines.md` — federal calendar; update for new tax year
- `defaults.locale` — Canada/UK/EU equivalents (Circular 230 has
  national-equivalent rules; refusal protocol picks the right citation)
