# technical-recruiter

Technical-recruiter agent bundle. Drafts job descriptions, designs
structured screening rubrics, and composes interview loops. **Does
not make hiring decisions.** Hard-refuses any input or inference about
protected-class attributes.

## What this bundle is

An agent's filesystem: a system prompt + JD-drafting + screening +
interview-loop templates + Cloudflare Worker shell + Tangle Sandbox
SDK. Runs in a per-tenant Tangle sandbox; LLM calls go through
`router.tangle.tools`.

## How a sandbox spawns it

1. Sandbox mounts `/agent` with this bundle's content.
2. Agent reads `system-prompt.md` (frontmatter declares
   `allowedDomains` + `allowedEnv` for sandbox enforcement).
3. The agent waits for a request: draft a JD, design a rubric, or
   compose an interview loop.
4. Output is emitted as `:::artifact` blocks the hiring team copies,
   edits, and signs off on.
5. The weekly cron (Monday 13:00 UTC) emits a sourcing-prompt — open
   roles, stale pipelines, where to invest the week's hours.

## Hiring-bias safeguards (built in)

- **Protected-class hard refusal.** Race, gender, age, national
  origin, disability, religion, family status, and proxies for any of
  them are non-inputs. The system prompt refuses and re-frames around
  bona-fide qualifications. The refusal is unconditional — there is
  no "but for this case" override.
- **Inclusive-language audit.** JD drafting strips coded language
  ("rockstar / ninja / guru / aggressive / digital native / recent
  grad") and flags requirements that don't trace to the work.
- **Structured interviews by default.** Same questions, same rubric,
  every candidate. The screening template is calibrated against a
  4-point Likert per signal, not a vibe score.
- **Calibration before kickoff.** The loop-design template requires
  a calibration session — the panel scores a reference transcript
  before the first real interview.
- **Independent reads first.** Debrief structure mandates each
  interviewer write their score before discussion. Anchoring is the
  largest single source of debrief noise; this is the cheapest fix.
- **Bar raiser as structural role.** The bar raiser audits process
  integrity (was the rubric followed? were notes evidence-based?) —
  not their personal read of the candidate.
- **Compensation: published bands only.** Bands are surfaced from
  the org's leveling/comp doc. The agent will not negotiate, commit,
  or anchor below a published band. JDs for pay-transparency
  jurisdictions include the band.

## Domain capabilities

- `jd-drafting` — bona-fide-qualification-driven JD authoring with
  inclusive-language audit and band publication. Methodology in
  `templates/jd-drafting-protocol.md`.
- `screening-rubric-design` — 4-point-Likert structured rubric per
  bona-fide signal, with calibration session and blinding guidance.
  Methodology in `templates/screening-rubric.md`.
- `interview-loop-design` — leveled loop composition (phone screen
  → coding → systems → behavioral → bar raiser), interview kit per
  role, debrief structure. Methodology in
  `templates/interview-loop-design.md`.

## Extension Points

- `system-prompt.md` — adjust role / refusal rules / output blocks.
  Re-run `prompt-frontmatter-valid` after edits. Do not weaken the
  protected-class refusal section.
- `templates/jd-drafting-protocol.md` — refine JD methodology, add
  org-specific style guide.
- `templates/screening-rubric.md` — refine rubric methodology, add
  domain-specific signals.
- `templates/interview-loop-design.md` — adjust leveling rubric,
  add role-archetype loops.
- `defaults.allowedDomains` — additional outbound URLs the bundle is
  permitted to reach (e.g. an internal ATS API). Anything outside
  this list is sandbox-blocked.
- `defaults.biasSafeguards` — toggles are advisory; the system-prompt
  refusal is the load-bearing enforcement.
