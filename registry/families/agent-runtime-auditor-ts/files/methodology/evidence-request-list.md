# Evidence request list (PBC list)

A PBC list is a contract between audit and the control owner. The
failure mode is a vague request that yields a 10-tab spreadsheet of
unusable data.

## Construction rule

For each control / objective, the request must specify:

1. **What** — the artifact, named precisely
2. **For whom** — control owner, system owner, custodian
3. **For what period** — exact date range, not "FY"
4. **In what format** — CSV / PDF / system extract / screenshot
5. **By when** — date the audit team needs it

If any of those five is missing, the request will be ignored or
mis-fulfilled.

## Templates by domain

### ITGC — change management

> **CM-001** — All production code changes deployed to <system>
> between <YYYY-MM-DD> and <YYYY-MM-DD>, exported as CSV from
> <ticketing-system>. Columns: ticket-id, requester, approver,
> deploy-timestamp, deploy-actor. Provided by <CM lead> by
> <YYYY-MM-DD>.

### ITGC — access management

> **AC-003** — User access listings for <system> as of <quarter-end>.
> System-extract from <IAM tool>, CSV. Columns: user-id, role,
> grant-timestamp, last-login, status. Plus terminations during
> the period from HRIS, joined on employee-id. Provided by
> <IAM admin> + <HR ops> by <YYYY-MM-DD>.

### Financial — journal entries

> **JE-001** — Manual journal entries posted to <GL> between
> <YYYY-MM-DD> and <YYYY-MM-DD>, exported from <GL system>. Filter
> to JE_TYPE = 'MANUAL'. Columns: je-id, period, posting-date,
> preparer, approver, debit-account, credit-account, amount,
> description. Provided by <GL accountant> by <YYYY-MM-DD>.

### Procurement / AP

> **AP-001** — Vendor master changes during the period, system-
> extract. Plus dual-control approval evidence for any change to
> banking instructions. Provided by <AP supervisor> by
> <YYYY-MM-DD>.

## What NOT to request

- "All emails about <topic>" → unscopable, drowns in noise
- "Documentation of the process" → too vague; ask for the specific
  artifact (SOP, runbook, README)
- "Anything related to" → the auditor names what they need

## Response handling

When the response arrives:

1. **Reconcile counts.** If you asked for "all changes Q1", does the
   record count match the volume reports?
2. **Spot-check completeness.** Pick one transaction you know
   happened and confirm it's in the population.
3. **Look for date-window violations.** Records dated outside the
   requested period suggest the export filter was loose.
4. **Identify what's missing.** If the request had 5 columns and
   only 3 came back, send a follow-up — don't paper over the gap.

## Re-request tracking

PBC items get re-requested. Track:

- original-request-date
- response-due-date
- actual-response-date
- delta (days late)
- re-request-count

Material delays in PBC fulfillment is itself a finding (control over
record retention / response cadence).
