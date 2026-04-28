# multi-agent-product-ops-ts

A curated four-role product-ops team — Product Manager, Designer, Engineering
Manager, and Customer Success — wired together with a hand-tuned weekly
cadence and explicit feature-development handoffs.

This is **not** a generic multi-agent shell. The differentiator is the
`## Coordination` section in `AGENTS.md`: a Monday-through-Friday cadence
that names who leads, what artifact handoffs trigger the next phase, and
how escalation works. The Tangle sandbox sidecar reads `agents.json` to
register each role as an OpenCode-native subagent.

## When to use this bundle

You want a single team that can:

- run discovery on the next feature
- scope feasibility and design fidelity in parallel
- commit a realistic sprint
- surface customer pain back into discovery
- prepare for a QBR without a context-switch tax

You do **not** want this if:

- you only need one role (use the single-role `agent-runtime-*` bundles)
- you need eng+design only with no PM/CS layer
- you need a research lab (different archetype, different cadence)

## Roles

- `roles/pm/` — Product Manager. Owns scope, hypothesis, kill criterion.
  Methodology: `discovery-cycle`, `prioritization-rice`, `prd-template`.
- `roles/designer/` — Product Designer. Owns flow, fidelity, usability.
  Methodology: `design-critique`, `ux-strategy`.
- `roles/eng-manager/` — Engineering Manager. Owns feasibility, capacity,
  sprint plan. Methodology: `tech-feasibility-scoping`, `sprint-planning`.
- `roles/customer-success/` — Customer Success. Owns user pain signal,
  churn risk, QBR. Methodology: `churn-risk-analysis`, `qbr-prep`.

## Coordination

See the `## Coordination` section in `AGENTS.md` for the full
Monday-Friday cadence, handoff rules, and escalation rules. See
`agents.json` for the machine-readable subagent registry (per-role
description, inline system prompt, tool/permission settings).

## Stakes

Moderate. Advisory only. The team **never** replaces the operator's actual
product team, board, HR, legal, security, or finance counsel.

## Configuration

Required environment variables:

- `TANGLE_API_KEY` — API key for the Tangle router

The bundle composes on the Cloudflare Worker substrate via:

- `agent-base:tangle` — Tangle floor
- `agent-base:secure` — secrets, audit, identity
- `agent-output:blocks` — `:::artifact`, `:::analysis`, `:::escalation`

## License

MIT
