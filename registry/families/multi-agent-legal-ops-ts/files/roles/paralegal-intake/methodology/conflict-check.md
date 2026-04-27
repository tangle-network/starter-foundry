# Conflict check

A real legal-ops intake runs a conflict check before any substantive
work. This methodology is a simplified, deterministic screen suitable
for an advisory team that is NOT a law firm. It does not replace a
firm-level conflicts database; it surfaces the obvious issues so they
don't slip into counsel's or auditor's working drafts.

## What you screen for

Three classes of conflict, in order:

1. **Adverse-party conflict** — is the counterparty in this matter a
   client, affiliate, or material relationship of the requester's
   organization that would create a direct conflict of interest?
2. **Prior-representation conflict** — has the requester (or this
   team) previously worked on a matter where the counterparty was
   represented, advised, or substantively involved? Even when this
   team isn't a law firm, prior substantive work creates an
   information-asymmetry conflict.
3. **Business-conflict / commercial-relationship** — is there an
   ongoing commercial relationship (vendor, customer, joint-venture)
   between the requester's organization and the counterparty that
   would taint independent advice?

## Inputs to ask for

Ask the requester:

- The legal name of the counterparty (and any known parents, named
  affiliates, named subsidiaries — if the requester provides them
  unprompted)
- Whether the requester's organization has any prior or ongoing
  business relationship with the counterparty (yes / no / unknown)
- For audit work: whether anyone on the requester's audit team has a
  current or recent (within 1 year) relationship with the auditee
  (employment, family, financial)

You do not run an external database. You ask, you record the answer,
and you mark the screen as `cleared`, `flagged`, or `unable-to-clear`.

## Decision rules

- `cleared` — counterparty is named; requester confirms no prior
  representation, no current business conflict, and no auditor-side
  independence concern (for audit matters)
- `flagged` — any "yes" answer above; route to outside counsel /
  ethics partner before proceeding (escalate, do NOT advise around
  the flag)
- `unable-to-clear` — counterparty cannot be named (e.g. "a vendor",
  "the other side"), or the requester does not know the answers; ask
  again; if still unable to clear, escalate

## Auditor-specific independence screen

For matters routed to auditor, also confirm:

- The auditor role on this team is NOT being asked to audit a process
  it helped design
- The auditor role is NOT being asked to opine on a control over a
  system it has direct access to as an operator
- No member of the requester's audit team has a financial,
  employment, or family relationship with the auditee in the period
  under review

If any of these is "yes" or "unknown", mark `flagged` and escalate.
Independence is the auditor's product; a flagged independence screen
is not a hand-off to auditor — it is an escalation to the audit
committee.

## What you do NOT do

- Pretend to run an external conflicts database
- Clear a flag by reframing it ("the relationship is small" → still
  flagged)
- Persist counterparty names with PII attached (use redactPII on the
  full counterparty record before the handoff packet)
- Skip the screen because the matter "feels low-stakes"

## Recording the result

The handoff packet (`:::handoff`) carries `conflict-check-status`
with one of three values: `cleared`, `flagged`, `unable-to-clear`.
Counsel and auditor MUST refuse to draft on `flagged` or
`unable-to-clear` and surface `:::escalation`.
