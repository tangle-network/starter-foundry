# Deficiency write-up

Standard 5-part finding format (IIA Yellow Book, AICPA AS-3, ISACA
ITAF). Every part is required.

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

> **Finding AC-2024-007: Privileged access not reviewed**
>
> **Condition:** During the period 2024-01-01 to 2024-09-30, no
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
> the IAM tool was upgraded in 2024-Q1. No compensating notification
> was put in place. System owner was unaware reviews were not being
> triggered.
>
> **Effect:** 14 privileged users in the system as of fieldwork.
> Three users had role changes during the period that, under
> quarterly review, would have been re-validated. One user
> retained access for 47 days post-role-change. No evidence of
> misuse was identified, but the access-creep risk was uncontrolled
> for ~9 months.
>
> **Recommendation:** (a) Restore the IAM quarterly-review workflow
> by 2024-12-15 (owner: <IAM admin>). (b) Perform a one-time
> retroactive review of all privileged users for the period 2024-01-01
> to date by 2024-12-31 (owner: <system owner>). (c) Add a quarterly
> control monitor to <GRC tool> to detect workflow disablement
> going forward.

## Severity rating

| Severity | Threshold |
|---|---|
| **Material weakness** | A deficiency or combination such that there is a reasonable possibility material misstatement won't be prevented or detected timely |
| **Significant deficiency** | Less severe than material weakness but important enough to merit attention by those charged with governance |
| **Control deficiency** | A deficiency in design or operation that does not rise to the above |
| **Observation** | Sub-deficiency — process improvement, not a control failure |

Materiality is a judgment call by a credentialed auditor. Draft a
proposed rating; the engagement lead approves.

## Common write-up failures

1. **Condition contains opinion.** "The team appears not to take
   this seriously." → strike. State the fact.
2. **Criterion missing or vague.** "Best practices" is not a
   criterion. Cite the specific framework section or policy paragraph.
3. **Cause = "human error."** Always one layer deeper. Why did the
   human err?
4. **Effect not quantified.** "May result in losses." → quantify or
   bound: "Population of $X exposed; potential undetected error
   range $Y-$Z."
5. **Recommendation without owner + date.** "Should be fixed." →
   "<role> should <action> by <date>."

## Output block

```
:::filing
type: deficiency
finding-id: <id>
severity: material-weakness | significant-deficiency | control-deficiency | observation
control-id: <linked control>
condition: <one line>
criterion: <one line>
cause: <one line>
effect: <one line>
recommendation: <one line>
owner: <role>
target-date: <YYYY-MM-DD>
:::
```

## Audit committee escalation

Material weaknesses and findings of fraud, management override, or
pervasive failure go to the audit committee chair within 1 business
day of identification. Use the `:::escalation` block (see
system-prompt.md).
