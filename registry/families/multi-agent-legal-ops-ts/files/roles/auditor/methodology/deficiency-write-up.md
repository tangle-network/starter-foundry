# Deficiency write-up

Standard 5-part finding format (IIA Yellow Book, AICPA AS-3, ISACA
ITAF). Every part is required. The auditor role on this team produces
the **draft**; a credentialed CIA / CISA reviews, edits, and signs.

## The 5 parts

1. **Condition** — what we found. Factual, specific, no opinion.
2. **Criterion** — what should be (the standard, control objective,
   policy section, framework requirement).
3. **Cause** — root cause of the deviation. Not "human error" —
   *why* did the human err? (Missing tool, missing training, missing
   handoff, threshold misset, etc.)
4. **Effect** — actual or potential impact. Quantified when possible.
   Risk if not corrected.
5. **Recommendation** — what management should do. Specific. Has an
   owner and a date.

## Example (fictional)

> **Finding AC-2026-007: Privileged access not reviewed**
>
> **Condition:** During the period 2026-01-01 to 2026-09-30, no
> quarterly review of privileged-user access to the production
> finance system (<name>) was performed. Policy <ref> requires
> quarterly review by the system owner.
>
> **Criterion:** SOX 404 ITGC framework, control AC-04 (Periodic
> Access Review). Internal policy <ref>, section 3.2: "Privileged
> access to financial-reporting systems shall be reviewed quarterly
> by the system owner; documentation retained for 7 years."
>
> **Cause:** Quarterly review reminder workflow was disabled when
> the IAM tool was upgraded in 2026-Q1. No compensating notification
> was put in place. System owner was unaware reviews were not being
> triggered.
>
> **Effect:** 14 privileged users in the system as of fieldwork.
> Three users had role changes during the period that, under
> quarterly review, would have been re-validated. One user retained
> access for 47 days post-role-change. No evidence of misuse was
> identified, but the access-creep risk was uncontrolled for ~9
> months.
>
> **Recommendation:** (a) Restore the IAM quarterly-review workflow
> by 2026-12-15 (owner: <IAM admin>). (b) Perform a one-time
> retroactive review of all privileged users for the period
> 2026-01-01 to date by 2026-12-31 (owner: <system owner>). (c) Add
> a quarterly control monitor to <GRC tool> to detect workflow
> disablement going forward.

## Severity rating

| Severity | Threshold |
|---|---|
| **Material weakness** | A deficiency or combination such that there is a reasonable possibility material misstatement won't be prevented or detected timely |
| **Significant deficiency** | Less severe than material weakness but important enough to merit attention by those charged with governance |
| **Control deficiency** | A deficiency in design or operation that does not rise to the above |
| **Observation** | Sub-deficiency — process improvement, not a control failure |

Materiality is a judgment call by a credentialed auditor. Draft a
proposed rating; the engagement lead approves. Never assert
materiality unilaterally — the role's disclaimer forbids it.

## Common write-up failures

1. **Condition contains opinion.** "The team appears not to take
   this seriously." → strike. State the fact.
2. **Criterion missing or vague.** "Best practices" is not a
   criterion. Cite the specific framework section or policy
   paragraph.
3. **Cause = "human error."** Always one layer deeper. Why did the
   human err?
4. **Effect not quantified.** "May result in losses." → quantify or
   bound: "Population of $X exposed; potential undetected error
   range $Y-$Z."
5. **Recommendation without owner + date.** "Should be fixed." →
   "<role> should <action> by <date>."
6. **Cause and recommendation mismatched.** If cause is "training
   gap," recommendation cannot be "buy a tool." Cause-fits-
   recommendation is the test.

## Output block

```
:::filing
type: deficiency
matter-id: <inherited from intake handoff>
disclaimer: DRAFT — credentialed CIA/CISA must review and sign; severity rating is proposed, not final
finding-id: <id>
proposed-severity: material-weakness | significant-deficiency | control-deficiency | observation
control-id: <linked control>
framework: SOX-404 | SOC2-CC6.1 | ISO27001-A.9.2.1 | NIST-CSF-PR.AC-1 | NIST-800-53-AC-2 | PCI-DSS-7.1 | HIPAA-164.308(a)(4) | other
condition: <one line; factual; no opinion>
criterion: <one line; cite framework section + policy paragraph>
cause: <one line; root cause, one layer deeper than "human error">
effect: <one line; quantified or bounded>
recommendation: <one line; specific>
owner: <role>
target-date: <YYYY-MM-DD>
:::
```

## Audit-committee escalation

Material weaknesses and findings of fraud, management override, or
pervasive failure go to the audit committee chair within 1 business
day of identification. Use the `:::escalation` block defined in
`coordination-protocol.md` section 4 — *escalate first, polish the
finding write-up second*. The escalation is procedural; the
finding-write-up will be reviewed by the credentialed auditor anyway.

```
:::escalation
from: auditor
trigger: fraud | material-weakness | pervasive-failure | management-override | evidence-tampering
finding-class: <one of the above>
recommended-recipient: audit-committee-chair | external-auditor | legal
reason: <one-line factual summary; PII-redacted>
artifact-status: drafting-stopped
:::
```

## Cross-handoff to legal-counsel

If the deficiency intersects:

- A **legal-claim risk** (the failed control creates exposure under a
  privacy regime, contract obligation, or regulator regime)
- A **contract dispute** (a customer SLA or vendor obligation depends
  on the control)
- **Litigation hold** intersecting the audit period

Cross-handoff to legal-counsel per `coordination-protocol.md` section
2d. Auditor still produces the deficiency write-up; counsel scopes
the legal-exposure question separately.

## What this draft is NOT

- Not the final finding — a credentialed CIA / CISA signs
- Not a materiality determination — proposed severity only
- Not a legal opinion — counsel handles legal exposure via cross-
  handoff
- Not a fraud determination — fraud findings go to audit-committee
  escalation chain immediately, with no severity-rating debate
- Not a control opinion — the auditor role on this team **never**
  says "this control passes"
