# wealth-manager

Personal wealth-manager agent bundle. **Not a registered investment
adviser. Not a fiduciary. Not licensed financial advice.** Provides
peer-style information on portfolio construction, rebalancing
mechanics, tax-loss harvesting protocol, and retirement-projection
methodology — anchored in published personal-finance literature
(Bogleheads three-fund, Trinity study, IRS wash-sale rules).

## Regulatory positioning

This bundle is designed to operate in the *information* lane, not the
*advice* lane defined by the Investment Advisers Act of 1940
§202(a)(11). It does not:

- Recommend specific securities (tickers, funds, ETFs)
- Issue trade orders or time markets
- Form an advisory relationship under federal or state law
- Substitute for a fee-only CFP, RIA, or CPA

Every output carries an `EDUCATIONAL — not investment advice` header,
and any user request that crosses into actionable advice (specific
buys/sells, specific Roth-conversion amounts, specific tax positions,
estate-planning structures, insurance/annuity recommendations) hard-
escalates via the `:::escalation` block to a licensed professional.

## What this bundle is

An agent's filesystem: a system prompt + allocation / harvest /
projection methodology templates + Cloudflare Worker shell + Tangle
Sandbox SDK. Runs in a per-user Tangle sandbox; LLM calls go through
`router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` + `notFiduciary: true` for sandbox
   enforcement).
3. By default the agent answers methodology questions and emits
   `:::artifact` blocks marked EDUCATIONAL.
4. Any specific security pick, actionable trade recommendation, tax
   advice question, insurance product, or estate-planning question
   triggers `:::escalation` and hands off to a licensed professional.
5. Monthly cron (1st of month, 14:00 UTC) runs the allocation-drift
   check against any portfolios the user has shared into VAULT.

## Domain capabilities

- `asset-allocation-review` — target allocation by age + risk
  tolerance + time horizon. Drift analysis using the Bogleheads 5/25
  rebalancing rule. Methodology in `templates/allocation-review.md`.
- `tax-loss-harvesting` — identify lots with unrealized losses,
  enforce the IRC §1091 30-day wash-sale window, describe the
  *category* of replacement security (never the ticker). Methodology
  in `templates/tax-loss-harvest-protocol.md`.
- `retirement-projection` — Trinity-style 4% rule sanity check,
  Monte Carlo projection with assumptions surfaced, sequence-of-
  returns sensitivity. Methodology in `templates/retirement-projection.md`.
- `regulatory-disclaimer` — every output includes the Investment
  Advisers Act §202(a)(11) disclaimer; every actionable-advice
  request is hard-escalated.

## Extension Points

- `system-prompt.md` — adjust the role / refusal triggers / output
  blocks. Re-run `prompt-frontmatter-valid` after edits.
- `templates/*.md` — refine methodology. Update the `retrieved` date
  in frontmatter when tax thresholds or contribution limits change.
- `defaults.allowedDomains` — additional outbound URLs (e.g.
  finra.org, investor.gov mirrors). Anything outside this list is
  sandbox-blocked.
- `src/lib/tools/` — wire in a real portfolio-data tool (Plaid,
  brokerage CSV import) once the host platform's data contract is
  finalized.
