# Control walkthrough

A walkthrough proves the control exists and operates as designed for
ONE transaction end-to-end. It precedes test-of-operating-effectiveness
(ToE) — you cannot ToE a control that hasn't walked through cleanly.

This is **draft work** for a credentialed CIA / CISA to review and
sign. The auditor role on this team does NOT issue the
implementation conclusion as final.

## Structure

1. **Control objective** — what risk does this control address?
2. **Control description** — who does what, when, with what evidence?
3. **Walkthrough sample** — one transaction, traced from initiation
   to recording. Document each handoff.
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

These are AICPA / IIA defaults. Confirm with the engagement's
specific sampling guidance — some firms use different tables.

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
4. **Threshold workarounds.** Control fires only above $X;
   population shows transactions split to stay under $X.
5. **System-config drift.** Control description says "system enforces
   2-factor"; system config shows 2FA is optional for this user role.

## Framework citation

Every walkthrough cites the framework section the control maps to.
Examples:

| Framework | Example citation |
|---|---|
| SOX 404 ITGC | AC-04 (Periodic Access Review) |
| SOC 2 | CC6.1 (Logical access controls) |
| ISO 27001 | A.9.2.1 (User registration and de-registration) |
| NIST CSF | PR.AC-1 (Identities and credentials are managed) |
| NIST 800-53 | AC-2 (Account Management) |
| PCI DSS | 7.1 (Limit access to system components) |
| HIPAA | 164.308(a)(4) (Information access management) |

If the framework + section is unknown, emit `:::question` and pause
until the engagement supplies the operative section text.

## Cross-handoff to legal-counsel

If the walkthrough surfaces:

- Evidence the control failure exposes the organization to **legal
  claim** (e.g. data-protection regulator inquiry, privacy class
  action, regulatory penalty)
- A **contract dispute** dependent on the control's operating status
  (e.g. customer SLA tied to the control)
- **Subpoena, regulator inquiry, or litigation hold** intersecting
  the audit period

Cross-handoff to legal-counsel per `coordination-protocol.md`
section 2d. Auditor still completes the walkthrough; counsel scopes
the legal exposure question separately.

## Hard escalation

If during walkthrough you observe ANY of:

- Evidence of fraud or intentional misstatement
- Material weakness in ICFR
- Pervasive control failure (multiple related controls failed)
- Management override of controls
- Evidence the client is altering documentation post-request

Emit `:::escalation` with `recommended-recipient:
audit-committee-chair` per `coordination-protocol.md` section 4 #6.
Drafting on the walkthrough stops; the escalation IS the response.

## Output

When the walkthrough is complete, emit:

```
:::filing
type: walkthrough
matter-id: <inherited from intake handoff>
disclaimer: DRAFT — credentialed CIA/CISA must review and sign
control-id: <id>
framework: SOX-404 | SOC2-CC6.1 | ISO27001-A.9.2.1 | NIST-CSF-PR.AC-1 | NIST-800-53-AC-2 | PCI-DSS-7.1 | HIPAA-164.308(a)(4) | other
period: <YYYY-Q#>
sample-txn: <txn-id, redacted as needed>
control-objective: <one line>
control-description: <one line>
steps:
  - step-1: <description, expected evidence, evidence-status>
  - step-2: <description, expected evidence, evidence-status>
  - ...
design-conclusion: effective | deficient | indeterminate
implementation-conclusion: effective | deficient | indeterminate
deficiency-class: <if applicable>
follow-on-recommended: ToE | re-walk | scope-expansion | escalation
:::
```
