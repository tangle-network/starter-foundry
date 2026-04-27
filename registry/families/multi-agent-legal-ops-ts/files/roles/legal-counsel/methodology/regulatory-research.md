# Regulatory Research (general method)

**DRAFT — NOT LEGAL ADVICE.** Use this as a structured first pass.
Final language for any binding decision must be reviewed by
bar-licensed counsel in the operative jurisdiction.

This is the method for general-principles regulatory research. The
moment a question requires jurisdiction-specific analysis (state UCC
variations, choice-of-law enforceability in a specific venue, non-US
regulatory specifics, state employment / consumer-protection
statutes), escalate to outside counsel — do not synthesize a binding
answer.

## Step 0 — Scope the question

Before any research, decompose:

1. **What is the operative question?** Re-state in one sentence
   ("Does Section X apply when Y?")
2. **What jurisdiction is the requester in?** (Country / state /
   regulator)
3. **What body of law applies?** (Federal, state, agency
   regulation, EU directive, common law)
4. **What is the operative time horizon?** (Active rule, proposed
   rule, retired rule)
5. **What deference applies?** (Statute > regulation > guidance >
   enforcement action > industry practice)

If the question requires jurisdiction-specific analysis past general
principles, STOP. Emit `:::escalation` and route to outside counsel.

## Step 1 — Source hierarchy

Use sources in this order. Do NOT skip up the hierarchy.

1. **Statute** — the operative U.S. Code section, state code, or
   foreign analog. Cite the section number and effective date.
2. **Regulation** — the operative CFR section, state regulation, or
   foreign analog implementing the statute.
3. **Agency guidance** — bulletins, FAQs, no-action letters,
   interpretive releases. Note the effective date and whether the
   guidance is rescindable.
4. **Enforcement actions / consent orders** — pattern of agency
   behavior. Probative, not binding.
5. **Case law** — published opinions interpreting the statute /
   regulation. Pay attention to circuit + jurisdiction.
6. **Secondary sources** — treatises, restatements, ALR. Use to find
   primary sources, never to substitute for them.

For research within `allowedDomains: law.cornell.edu`, prefer
Cornell LII for federal statute and CFR. Cite the URL and the
section identifier.

## Step 2 — Output a memo, not a verdict

The deliverable is a **memo** that lays out the facts, the operative
sources, the analysis under general principles, and the open
questions a bar-licensed attorney must close before relying on the
analysis.

Memo structure:

```
:::artifact
type: regulatory-research-memo
matter-id: <inherited from intake handoff>
disclaimer: DRAFT — NOT LEGAL ADVICE; jurisdiction-specific analysis NOT performed; final review by bar-licensed counsel required
question: <one-sentence restatement>
jurisdiction: <country/state/regulator>; analysis = general principles
operative-sources:
  - statute: <citation, effective date>
  - regulation: <citation>
  - guidance: <citation>
analysis: <≤500 words; general principles only>
open-questions: <items requiring jurisdiction-specific analysis>
escalation-recommendation: <when outside counsel must close the loop>
:::
```

## Step 3 — Hard-escalation triggers

Even when the question seems researchable, escalate when:

- The requester needs the answer to **make a binding decision today**
- The question touches a **regulated industry** with industry-
  specific counsel norms (healthcare-clinical, financial services,
  defense, insurance, broker-dealer, regulated utilities, cannabis,
  gambling)
- The question is **state-specific** — state UCC variations, state
  employment law, state consumer-protection statutes (CCPA, Cal
  AB-1184, NY SHIELD, Illinois BIPA)
- The question involves **non-US law** — GDPR specifics, UK DPA, PIPL,
  cross-border data transfer mechanisms
- The question is **enforcement-active** — a regulator has already
  contacted the requester, or an investigation is ongoing
- The question involves **criminal exposure** — sanctions, export
  controls, FCPA, anti-kickback

## Step 4 — Anti-patterns

These are the failure modes that turn a useful memo into a liability.
Avoid:

- **Citing the statute number without reading the section.** The
  agent's research must surface the operative language; do not
  reproduce a citation from training data without confirming the
  section text via `law.cornell.edu` (or the equivalent allowed
  source)
- **Synthesizing a state-specific answer from federal sources.**
  Federal preemption is rare and narrow; treating federal sources
  as universal is a malpractice-adjacent shortcut
- **Quoting from a retired rule.** Rules are amended; check the
  effective date
- **Eliding the deference question.** Statute beats regulation beats
  guidance; failing to label a source's hierarchy in the memo lets
  the requester rely on guidance that has been retracted
- **Treating an enforcement action as binding precedent.**
  Enforcement is probative, not authoritative. Frame it as such
- **Promising a definitive answer.** The memo concludes "general
  principles suggest X; jurisdiction-specific analysis required to
  confirm" — never "the answer is X"

## Step 5 — Cross-handoff to auditor

When the regulatory question touches a control regime (SOX, SOC 2,
HIPAA technical safeguards, PCI DSS, NIST 800-53), cross-handoff to
auditor per `coordination-protocol.md` section 2c. Counsel produces
the legal interpretation; auditor produces the control walkthrough
that operationalizes it.
