# real-estate-advisor

Real-estate analysis companion. **Not a licensed real-estate broker,
salesperson, appraiser, attorney, or CPA.** Drafts comparable-market
analyses, cap-rate / NOI math, and offer-strategy frameworks the user
can take to their own licensed agent for execution.

## What this bundle is

An agent's filesystem: a system prompt + comp / cap-rate / offer-
strategy templates + Cloudflare Worker shell + Tangle Sandbox SDK.
Runs in a per-user Tangle sandbox; LLM calls go through
`router.tangle.tools`. Jurisdiction-agnostic — local market norms,
transfer taxes, and 1031-exchange execution rules are out of scope and
escalate to a licensed agent / CPA / attorney.

## Regulatory positioning

- **Not a licensed broker.** No agency relationship is formed by
  using this bundle. The agent does not represent the user in any
  real-estate transaction.
- **Jurisdiction-agnostic.** State and local rules — transfer tax,
  disclosure obligations, agency law, escrow handling, license
  reciprocity — vary materially. The agent does not interpret them.
- **Fair Housing Act compliant.** The agent analyzes property
  attributes only. It refuses to rate, compare, or recommend
  neighborhoods on demographic, school-assignment, family-fit, or
  social-character grounds. See `system-prompt.md` "Hard refusals"
  for the full list of refused framings.
- **Not an appraisal.** A CMA is not an appraisal. For lending,
  divorce, estate, or court use, escalate to a licensed appraiser.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. By default the agent runs in clarification mode — asks for the
   subject property's SqFt, beds, baths, condition, lot, and the
   user's purpose (CMA / cap-rate / offer-strategy) before
   computing anything.
4. On consent, loads the matching template and produces an
   `:::artifact` block with the regulatory header.
5. Any binding-decision request, jurisdiction-specific tax or title
   question, tenant or HOA dispute, or demographic-coded
   neighborhood question triggers an `:::escalation` block.

## Domain capabilities

- `comp-analysis` — comparable-market-analysis methodology:
  comparable-set selection (radius, sale window, SqFt tolerance,
  bed/bath match), per-attribute adjustment grid, GLA-weighted
  reconciliation, IQR outlier exclusion, confidence interval, refuse
  conditions. Methodology in `templates/comp-analysis.md`.
- `cap-rate-worksheet` — investment-property math: gross rent build,
  vacancy and credit-loss, opex line items, capex reserve, NOI, cap
  rate, cash-on-cash, DSCR, sensitivity table, when cap rates
  mislead (gut-renovation, owner-occupier comps, ground leases).
  Methodology in `templates/cap-rate-worksheet.md`.
- `offer-strategy` — offer-strategy framework: seller-motivation
  research, contingency stack (financing / inspection / appraisal /
  sale-of-current-home), escalation clauses, earnest-money
  calibration, leaseback. ALL binding-decision support escalates;
  the artifact is a strategy memo, not a draftable offer.
  Methodology in `templates/offer-strategy.md`.

## Extension Points

- `system-prompt.md` — adjust the role / refusal rules / output
  blocks. Re-run `prompt-frontmatter-valid` after edits. Do not
  weaken Fair Housing Act language.
- `templates/comp-analysis.md` — refine adjustment-grid defaults
  for a specific market (e.g. NYC condos vs. SF SFR).
- `templates/cap-rate-worksheet.md` — adjust opex-ratio defaults,
  vacancy assumptions, capex-reserve schedules per asset class.
- `templates/offer-strategy.md` — refine contingency-stack defaults
  per market temperature (buyer's vs. seller's market).
- `defaults.allowedDomains` — additional outbound URLs (e.g. the
  user's own MLS or county-assessor portal) the bundle is permitted
  to reach. Anything outside this list is sandbox-blocked.
