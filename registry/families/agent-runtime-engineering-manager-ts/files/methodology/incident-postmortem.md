# Incident Post-Mortem Template

## Principles
- **Blameless**: focus on systems, not people. The person who pushed the
  button is *information*, not the root cause. Replace "X did Y" with
  "the system allowed Y, with no guardrail."
- **Actionable**: every finding produces a concrete change to code,
  config, runbook, alert, or process — with an owner and a date.
- **Timely**: draft within 48 hours of resolution, while memory is
  fresh and the on-call still has context.
- **Honest about severity**: don't downgrade post-hoc to make the
  scorecard look better; the org's job is to learn, not to report
  green.

## Sections (use this skeleton)

### 1. Summary

- One paragraph: what broke, when, who was affected, how it was
  resolved.
- Severity: (SEV1 = customer-impacting outage / SEV2 = degraded /
  SEV3 = internal / SEV4 = near-miss)
- Detection latency, resolution latency, total duration.
- Customer impact: count of affected users / requests / dollars.

### 2. Timeline (UTC)

Bullet each material event:
- T-0: change merged / deploy started
- T+x: first error signal (which alert / dashboard / customer report)
- T+y: on-call paged
- T+z: hypothesis formed
- T+a: mitigation applied (rollback / feature flag / scaling)
- T+b: resolution confirmed (which dashboard recovered)

For each entry, record who saw it (role, not name), how they saw it
(channel), and what they did. The timeline shows where minutes were
lost — usually in detection or in hypothesis-formation.

### 3. Root cause

Write a single specific sentence describing the systemic failure.
Examples:
- "Bad: the engineer pushed a wrong config." Good: "config rollouts
  bypassed the staging environment because the rollout flag was set
  to `force=true` for an unrelated experiment from 6 weeks ago, and
  the bypass was undocumented."
- "Bad: cache miss." Good: "the cache key included a timestamp that
  changed every minute, causing 100% miss rate at peak; the key
  shape was introduced in PR #1234 without a hit-rate alert."

### 4. Contributing factors

What made this incident *possible* or *worse* than it had to be:
- Monitoring: the alert fired late / not at all / on the wrong
  channel / went to the wrong rotation.
- Process: rollback playbook was missing / outdated / required
  privileged access only one engineer had.
- Knowledge: oncall didn't know the system, no runbook, no
  architecture diagram, ownership unclear.
- Tooling: the deploy tool didn't surface the regression metric in
  the rollout UI; the rollback required a 30-minute custom script.
- Capacity / dependencies: an upstream dep was at 95% before the
  incident; we were one event away from saturation.

### 5. Action items

Each item must have:
- A specific change (code, config, alert threshold, runbook, RBAC)
- An owner (named team or named role, not "we")
- A due date
- A type tag: **preventive** (stops recurrence), **detective**
  (catches it earlier next time), **mitigative** (reduces blast
  radius), **process** (changes how the team operates)
- Severity tag: P0 / P1 / P2

| ID | Action | Owner | Type | Due | Sev |
|----|--------|-------|------|-----|-----|
| A1 | Add hit-rate alert at <threshold> | Cache team | Detective | 2026-05-10 | P0 |
| A2 | Block force-flag rollouts on prod without 2-person review | Deploy team | Preventive | 2026-05-15 | P0 |

### 6. Went well / didn't go well

- What was *positive* in the response (clear comms, clean rollback,
  helpful alert) — name it so the team keeps doing it.
- What was *negative* (slow paging, confused ownership, missing
  runbook) — feeds the action items.
- "Lucky" calls explicitly: "we got lucky that the bug only affected
  10% of traffic; without that, blast radius would have been 10x" —
  luck-cases need pre-emptive action items because next time we
  may not be lucky.

### 7. Open questions

What we don't know yet — for follow-up investigation. Don't pretend
the post-mortem has all the answers.

## Follow-up discipline

- Track every action item to completion in the team's actual
  backlog with the post-mortem ID. A post-mortem with stalled action
  items is theatre.
- Read prior post-mortems in the same area before writing the next
  one — repeat findings indicate the action items aren't landing.
- Share with the relevant stakeholders (eng, ops, product, support,
  legal/compliance if customer-impacting).
- Run a 15-minute review meeting where the team can ask questions
  about the cause. The doc alone is not enough.

## Output block

Wrap in `:::artifact` with `template: incident-postmortem`. Tag
severity, customer impact, and the count of preventive / detective
action items so the org can roll up to a learning-system metric.

## Refusal triggers

The agent will *not*:
- Name individual engineers as causes (blameless culture is hard to
  maintain; the agent will not undermine it)
- Approve a post-mortem that has zero preventive or detective action
  items — that's a status report, not learning
- Sign off on customer comms or legal disclosure language without
  the human in the loop
