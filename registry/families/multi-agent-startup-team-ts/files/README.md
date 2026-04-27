# multi-agent-startup-team-ts

Curated multi-agent startup leadership team — five roles, hand-tuned
coordination, baked-in handoff protocols. **Advisory only — not a
board, not a fiduciary, not a substitute for the operator's lawyer,
CPA, HR counsel, or licensed financial advisor.**

## What this bundle is

A self-contained team of five specialist agents that coordinate via
explicit handoff blocks. The team is loaded as a single deploy; the
Tangle sandbox sidecar reads `agents.json` (OpenCode-native subagent
registry) to register each role and uses `AGENTS.md` as the
orchestrator's system prompt. The orchestrator's `AGENTS.md`
contains a `## Coordination` section that is the source of truth
for inter-role routing, handoff format, and joint-decision cadence.

The five roles:

| Role | Owns | Methodology files |
|---|---|---|
| **CEO** | strategy, OKRs, weekly review, decision journal, board prep | `weekly-review`, `decision-journal`, `okr-design` |
| **CTO** | engineering 1:1 cadence, sprint pace, tech-debt triage, architecture decisions | `one-on-one-cadence`, `tech-debt-triage`, `architecture-decision` |
| **CMO** | positioning, ICP, channel-experiment design, growth scoreboard | `positioning-canvas`, `channel-experiment-design` |
| **HR / Recruiter** | JD drafting, structured interview rubric design, recruiting-loop composition, comp-band hygiene | `recruiting-loop-design`, `interview-rubric` |
| **CFO Advisor** | burn / runway model, unit economics, fundraise prep, board financials | `burn-runway-model`, `fundraise-prep` |

## What makes this template "curated"

This is **not** a generic multi-agent harness. The roles are
hand-tuned to coordinate:

- **Explicit routing table** in `AGENTS.md` (`## Coordination`) —
  every topic has a primary respondent and a list of common
  collaborators.
- **`:::handoff` block format** — a role that catches a request
  outside its scope emits a structured handoff to the right peer
  rather than improvising.
- **Joint-decision turns** — weekly review, quarterly OKRs, monthly
  board update, fundraise prep, major incident post-mortem — each
  has a declared role-set and a designated assembler.
- **Cross-role escalation triggers** — HR refusals on protected-
  class inputs apply even when CEO/CTO/CMO/CFO ask. CFO Advisor
  refuses personal investment advice even from the operator. CTO
  refuses substantive performance-management calls and routes to
  HR + outside counsel.
- **Single methodology source of truth** — each role's methodology
  files reference the others' artifacts (e.g. CMO's channel-
  experiment template includes a CFO-Advisor pricing handoff before
  launch; CEO's OKR template requires every peer to cascade KRs).

The difference from a naïve composition (five single-role agents
glued together) is the **protocol**. Without the `## Coordination`
section in `AGENTS.md`, five roles produce five overlapping
answers. With it, one role answers and the others contribute on
demand.

## How a sandbox spawns the team

1. Sandbox mounts `/workspace` with this bundle's content.
2. Sidecar reads `agents.json` to enumerate subagents (each with
   inline `prompt`, `tools`, and `permission` blocks per the
   OpenCode shape).
3. Sidecar uses `AGENTS.md` as the orchestrator's system prompt —
   the `## Coordination` section is the source of truth for
   inter-role behavior.
4. Each role's prompt is the inline `prompt` field in `agents.json`
   (mirrored from `roles/<id>/AGENTS.md`); methodology files that
   match the user's request are loaded by the role on demand.
5. Default respondent (CEO) handles the first turn unless the
   request explicitly names a role.
6. Handoffs route to the named peer; joint-decision turns assemble
   contributions from multiple roles into a single artifact.
7. Mondays 14:00 UTC cron triggers a CEO-assembled weekly review.
   Fridays 15:00 UTC cron triggers a CFO-Advisor burn / runway
   refresh.

## Advisory boundary

This bundle is **moderate stakes**. The biggest failure mode is
over-reliance: the operator treats a five-role advisory pod as a
decision authority. Every role enforces an escalation contract:

- HR / personnel actions → operator's HR + employment counsel
- Securities, M&A, term-sheet language → operator's corporate
  counsel
- Tax structuring → operator's CPA / tax attorney
- Personal investment advice → operator's licensed financial
  advisor
- Mental-health crises → operator's EAP / crisis resources
- Fiduciary territory → operator's board chair + corporate counsel
- Audit / assurance → operator's auditor

Every escalation emits a `:::escalation` block naming the
**outside professional** (not a peer role). Preparation for that
conversation (framing, documents, asks) is on-scope; the substantive
opinion itself is not.

## Bias safeguards (HR role, applied team-wide)

- **Protected-class hard refusal.** HR will refuse and re-frame
  any input touching race, gender, age, national origin,
  disability, religion, family status, or proxies — **even when a
  peer role asks.** CEO/CTO/CMO/CFO cannot unlock these refusals.
- **Inclusive-language audit.** JDs strip coded language
  ("rockstar / ninja / aggressive / digital native / recent grad")
  and flag requirements that don't trace to the work.
- **Structured interviews by default.** Same questions, same
  rubric, every candidate. 4-point Likert with behavioral
  anchors per point.
- **Calibration before kickoff.** Loop-design template requires a
  calibration session before the first real candidate.
- **Bar raiser as structural role**, drawn from outside the
  immediate hiring team, with veto authority and a process-
  integrity audit charter.
- **Compensation: published bands only.** Bands sourced from the
  org's leveling/comp doc; published in JDs for pay-transparency
  jurisdictions.

## Domain capabilities

- `team-coordination-protocol` — routing rules, handoff format,
  escalation triggers, joint-decision cadence. Source of truth for
  inter-role behavior. See the `## Coordination` section in
  `AGENTS.md`.
- `weekly-review` (CEO) — seven-dimension Monday review with CFO /
  CMO / CTO contributions and CEO assembly.
- `decision-journal` (CEO) — Bezos Type-1/Type-2 reversibility,
  multi-role evidence branching, predict-then-score calibration.
- `okr-design` (CEO) — Doerr-style 3–5 objectives × 3 KRs with
  CTO / CMO / CFO Advisor / HR cascade and audit.
- `one-on-one-cadence` (CTO) — Grove + Fournier 1:1 frame, SBI
  feedback, career rotation, escalation triggers to HR + EAP.
- `tech-debt-triage` (CTO) — impact × value quadrant, CFO-priced
  dollar cost, sprint allocation rule.
- `architecture-decision` (CTO) — Nygard ADR with CFO-Advisor cost
  evaluation and build-vs-buy heuristic.
- `positioning-canvas` (CMO) — Crossing-the-Chasm beachhead +
  alternatives + whole-product gap, with CTO/CFO/CEO handoff
  triggers.
- `channel-experiment-design` (CMO) — Traction 19-channel frame
  with CFO-Advisor mandatory pricing pre-launch.
- `recruiting-loop-design` (HR) — leveled loop composition (phone
  → coding → systems → behavioral → bar raiser), interview kit per
  role family, debrief structure.
- `interview-rubric` (HR) — 3–5 bona-fide signals per stage,
  4-point Likert with behavioral anchors, calibration session.
- `burn-runway-model` (CFO Advisor) — three-scenario model
  (default-alive / plan / stress), T-9 alarm, sensitivity table.
- `fundraise-prep` (CFO Advisor) — deck math + comps + diligence
  data room + kill criteria, with outside-counsel escalation for
  term-sheet language.

## Extension points

- `AGENTS.md` (top-level, `## Coordination` section) — routing
  table, escalation triggers, joint-decision cadence. Edits here
  change team behavior across all five roles.
- `agents.json` — OpenCode-native subagent registry: `mode`,
  `description`, inline `prompt`, `tools`, `permission` per
  subagent. Edit to add/remove roles or adjust per-role tool
  permissions.
- `roles/<role>/AGENTS.md` — adjust role / advisory boundary /
  escalation triggers. Re-run `agents-md-valid` after edits, then
  regenerate `agents.json` so the inline prompt mirrors the file.
- `roles/<role>/methodology/` — refine the role's methodology;
  swap in alternative frames (e.g. swap `okr-design` for V2MOM by
  replacing the file; keep the capability id stable).
- `defaults.team` — declared team config consumed by the runtime.
- `defaults.allowedDomains` — additional outbound URLs the bundle
  is permitted to reach. Anything outside this list is sandbox-
  blocked.

## Source material

Templates draw on:

- Andy Grove, *High Output Management* (operating cadence, 1:1
  frame, output-oriented review)
- John Doerr, *Measure What Matters* (OKR shape, grading scale,
  cascading discipline)
- Jeff Bezos, 1997/2015/2016 shareholder letters (Type 1 / Type 2
  decisions, day-1 mentality)
- Camille Fournier, *The Manager's Path* (1:1 career conversation
  cadence)
- Lara Hogan, *Resilient Management* (SBI feedback, escalation
  discipline)
- Geoffrey Moore, *Crossing the Chasm* (positioning, beachhead
  segment, whole product)
- April Dunford, *Obviously Awesome* (positioning as deliberate
  choice)
- Gabriel Weinberg & Justin Mares, *Traction* (19-channel framework,
  bullseye method)
- Frank Schmidt & John Hunter (1998), "The Validity and Utility of
  Selection Methods" (structured interview validity)
- David Skok, SaaS Metrics 2.0 (unit economics)
- Mark Suster, "Default Alive vs Default Dead" (T-9 alarm)
- Brad Feld & Jason Mendelson, *Venture Deals* (term-sheet anatomy)
- Michael Nygard (2011), "Documenting Architecture Decisions" (ADR
  format)
