# Deadline Tracker Template

## Purpose
Maintain a single, durable record of every grant cycle a
nonprofit / lab / writer is engaged with — from prospect through
final report. Missed deadlines are the most common reason small
nonprofits forfeit funding they otherwise qualified for.

## When to use
Trigger when the user is managing more than one or two grant
relationships, ramping into a new fiscal year, or recovering from
a missed-deadline near-miss. For proposal-writing itself, route
to grant-proposal-canvas.md. For final reports, route to
reporting-template.md.

## Method

1. **Capture the full lifecycle, not just the proposal date.**
   Each grant has up to seven dates that matter:
   - Prospect / initial outreach scheduled
   - LOI (letter of inquiry) due
   - Full proposal due
   - Site visit / interview window
   - Award notification expected
   - Funds transfer expected
   - Interim report(s) due
   - Final report due
   - Renewal LOI / re-application window
2. **Pre-deadline buffers.** For each external deadline, add
   internal milestones:
   - **2 weeks before**: full draft complete, internal review
     scheduled.
   - **1 week before**: review complete, revisions in.
   - **3 business days before**: final upload / mail.
   - **Day before**: confirmation of receipt.
   Working back from the external deadline this way reveals
   schedule conflicts early.
3. **Required attachments per funder.** Each funder has its own
   list, often overlooked:
   - 501(c)(3) determination letter
   - Most-recent audited financial statements
   - Board list with affiliations
   - Prior 990 (often previous fiscal year)
   - Project budget in the funder's template
   - Logic model (some funders require)
   - Organizational budget
   - Letters of support from partners
   - Demographic / impact data
   Maintain a shared "attachments locker" so each application
   pulls from one source of truth.
4. **Status taxonomy.** Use a small, strict set:
   - **Prospect**: identified, not yet contacted.
   - **In conversation**: contacted, no application yet.
   - **LOI submitted** / **Invited** / **Declined-LOI**.
   - **Drafting**: full proposal in progress.
   - **Submitted**: filed; awaiting decision.
   - **Awarded**: funded; in active grant period.
   - **Declined**: rejected; record reason for next cycle.
   - **Reporting**: in active reporting; not yet closed.
   - **Closed**: cycle complete.
5. **Reminders and ownership.**
   - Each deadline has a lead and a backup.
   - Calendar invites set 2 weeks, 1 week, and 3 days before
     each deadline.
   - Email reminders to the lead with the attachment checklist.
6. **Capacity guardrails.**
   - Track the count of active proposals per development staffer;
     if any one person has >3 in-flight, the org is over-capacity.
   - Track total funder-relationships under management; ratio
     to staff hours.
7. **Renewal radar.**
   - Awarded grants typically have re-application windows
     6–12 months from award. Surface these proactively.
   - Lapsed multi-year grants need a "would they consider us
     again" outreach a year before re-applying.

## Master tracker schema (suggested)

| Funder | Program | Cycle | LOI Due | Full Due | Award Date | Award Amount | Reports Due | Status | Lead | Notes |
|--------|---------|-------|---------|----------|------------|--------------|-------------|--------|------|-------|

Plus a per-funder detail block with:
- Funder mission alignment (1 sentence)
- Past relationship (last gift, last decline, contact name)
- Required attachments (linked to attachments locker)
- Application URL + login
- Funder-specific quirks (page limits, font requirements,
  budget format, narrative themes preferred)

## Common tracker failures

1. **Single-deadline tracking.** Tracking only the proposal due
   date misses LOI, reports, renewal — many lapses happen here.
2. **No buffers.** Backing up to the day-of-deadline workflow
   produces last-minute submissions and missed attachments.
3. **No attachment locker.** Each application re-creates the
   same attachments from scratch; one update misses; auditors
   notice.
4. **Status drift.** "Submitted" → "...?" — without follow-up
   discipline, awards and declines aren't recorded; the next
   cycle has no memory.
5. **Capacity blind.** Saying yes to every prospect; staff burns
   out; quality drops; funders notice.
6. **Lost contact transitions.** When a funder's program officer
   changes, the relationship hand-off isn't captured; next
   cycle begins cold.

## Output

```
:::artifact
template: deadline-tracker
period: "FY2026"
grants:
  - funder: "..."
    program: "..."
    cycle: "2025–2026"
    loi-due: "2025-09-15"
    full-due: "2025-11-01"
    award-date: "2026-02-15 (expected)"
    requested-amount: $...
    reports:
      interim: "2026-08-01"
      final: "2027-02-01"
    status: "Drafting"
    lead: "..."
    backup: "..."
    notes: "..."
upcoming-week: [...]
upcoming-month: [...]
overcapacity-flags: [...]
:::
```

## Refusal

- The agent will not approve a tracker that omits report dates;
  reports are how funder relationships sustain.
- The agent will not push the team toward a higher proposal
  count when capacity-flags fire.
