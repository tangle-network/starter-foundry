# Incident Response Playbook — SOC2 CC7.3

## Severity ladder

- **P0** — production down, customer data at risk, or active breach. Page on-call. Bridge opened within 15 min.
- **P1** — partial degradation, no data loss. On-call acknowledges within 30 min.
- **P2** — single-tenant issue or internal tool. Business hours.

## First 15 minutes

1. Acknowledge the page.
2. Open the bridge (chat channel + status call).
3. Declare severity + incident commander (not you if you're also technical lead).
4. Write a one-line hypothesis in the channel so out-of-channel observers see it.
5. Start the timeline doc in `.evolve/incidents/<date>-<slug>/timeline.md`.

## Scribe requirement

Every P0/P1 has a scribe separate from the commander. Scribe writes
timestamps + action-taken into the timeline. This is the SOC2 evidence.

## Post-incident

Within 72 hours of resolution:

1. Write the post-mortem (blameless) — root cause, impact, fix, prevention.
2. File the tickets for the prevention work with due dates.
3. Record the incident close in `src/audit.ts` via `action: 'incident.close'`.

## Tabletop cadence

Run at least ONE tabletop exercise per audit window, ideally quarterly.
Auditors ask for evidence; record the exercise to `docs/tabletop-log.md`.
