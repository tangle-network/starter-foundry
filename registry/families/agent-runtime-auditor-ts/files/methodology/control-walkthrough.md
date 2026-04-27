# Control walkthrough

A walkthrough proves the control exists and operates as designed for
ONE transaction end-to-end. It precedes test-of-operating-effectiveness
(ToE) — you cannot ToE a control that hasn't walked through cleanly.

## Structure

1. **Control objective** — what risk does this control address?
2. **Control description** — who does what, when, with what evidence?
3. **Walkthrough sample** — one transaction, traced from initiation to
   recording. Document each handoff.
4. **Design conclusion** — does the design address the objective?
5. **Implementation conclusion** — did the walkthrough show the
   control operating?

## Sample selection

For walkthrough: ONE transaction. Choose:

- A recent transaction (within the audit period)
- A non-trivial one (zero-dollar, void, or test transactions skew)
- One that exercises every step of the control description (no
  skipping the approval review because it was below threshold)

For ToE: sample size depends on control frequency.

| Frequency | Annual occurrences | Min sample |
|---|---|---|
| Manual, multiple/day | >250 | 25 (or 40 for SOX) |
| Manual, daily | ~250 | 15-25 |
| Manual, weekly | ~52 | 5 |
| Manual, monthly | 12 | 2 |
| Manual, quarterly | 4 | 2 |
| Manual, annual | 1 | 1 |
| Automated (after walkthrough) | n/a | 1 (re-perform) |

These are AICPA / IIA defaults. Confirm with the engagement's specific
sampling guidance — some firms use different tables.

## Evidence types per step

For each step in the control description, name the expected evidence:

- **System-generated**: ticket, log entry, system report, screenshot
  with timestamp
- **Manual**: signed approval, email thread, meeting minutes
- **Reconciliation**: GL extract, ledger detail, signoff document

Avoid: "auditor inquiry." Inquiry alone is the weakest evidence and
cannot stand on its own for a key control.

## Common walkthrough failures

1. **Missing handoff evidence.** Step 2 happens, step 4 happens, but
   step 3 (the approval) has no documented evidence trail.
2. **Same-person initiation + approval.** Segregation-of-duties
   violation hidden in a "self-service" workflow.
3. **Approval after the fact.** Timestamps show approval came *after*
   transaction processing. Common in expense workflows.
4. **Threshold workarounds.** Control fires only above $X; population
   shows transactions split to stay under $X.
5. **System-config drift.** Control description says "system enforces
   2-factor"; system config shows 2FA is optional for this user role.

## Output

When the user has the walkthrough complete, draft:

```
:::filing
type: walkthrough
control-id: <id>
period: <YYYY-Q#>
sample-txn: <txn-id, redacted as needed>
design-conclusion: effective | deficient | indeterminate
implementation-conclusion: effective | deficient | indeterminate
deficiency-class: <if applicable>
:::
```
