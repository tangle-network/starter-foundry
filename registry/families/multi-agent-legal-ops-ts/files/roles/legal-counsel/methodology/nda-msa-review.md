# NDA + MSA Review Checklists

**DRAFT — NOT LEGAL ADVICE.** Use this as a structured first pass.
Final language for any binding execution must be reviewed by
bar-licensed counsel.

This file consolidates the NDA-specific and MSA-specific checklists.
Use the corresponding section based on the matter-type from the
intake handoff packet.

---

# Part A — NDA Review Checklist

## A.0 — Posture

- **Mutual or unilateral?** If only one party is disclosing, a
  unilateral NDA is normal; once both parties expect to share,
  mutualize. Default-redline unilateral → mutual when the relationship
  is exploratory (partnership talks, M&A diligence both ways,
  vendor-evaluation where the vendor sees the buyer's roadmap).
- **Standalone NDA or NDA-within-MSA?** If embedded, check for
  conflict with the MSA's own confidentiality clause (survival
  period, return-of-info obligations).

## A.1 — Definition of "Confidential Information"

- All forms — written, oral, visual, electronic, observed?
- Marking required? Marking weakens protection for oral / observed
  disclosures. Acceptable variant: oral disclosures must be confirmed
  in writing within 30 days.
- Sweeps in derivative work product (notes, analyses, summaries the
  recipient creates from disclosed material)? Should.
- Covers the fact of discussions (existence, status, terms)?
  Important for M&A and partnership talks.

## A.2 — Exclusions from confidentiality

Standard five (recipient should insist on all):

- Already known to recipient before disclosure
- Independently developed without use of confidential info
- Lawfully received from a third party with no duty of confidence
- In the public domain through no fault of recipient
- Required to be disclosed by law / court order (with prompt notice
  + cooperation in seeking protective order)

Flag: missing "independently developed" exclusion (most commonly
stripped); missing prompt-notice on legal-order disclosures.

## A.3 — Term

- **Term of the NDA** (during which disclosures are protected)
- **Confidentiality period** (during which the recipient must keep
  protected info confidential — often longer)

Market: 2–5 year confidentiality period for general business info;
**indefinite for trade secrets**. Flag a single term that expires
trade-secret protection on a fixed window.

## A.4 — Permitted uses

- Tightly scoped to the **stated purpose** ("evaluating a potential
  commercial relationship") — not "any business purpose"
- **Need-to-know** restriction inside the recipient's organization
- **Affiliate / contractor** sharing only with equivalent
  confidentiality obligations bound in writing

## A.5 — Return / destruction

- Upon written request **or** termination, recipient returns or
  destroys
- **Certification of destruction** in writing if destroyed
- **Carve-outs**: legal-hold copies, automated-backup copies (with
  ongoing confidentiality obligation) — these are reasonable

## A.6 — Residuals clause

Recipient often pushes for a residuals clause: information retained
in unaided memory of personnel may be used freely. **High-value
disclosers should resist or narrow** — limit to general skills and
know-how, exclude trade secrets and specific technical information.

## A.7 — Equitable remedies

- Acknowledgment that breach causes irreparable harm
- Right to seek **injunctive relief without bond** (or with nominal
  bond)
- Without limiting other remedies (not sole-and-exclusive)

## A.8 — No license / no obligation

- Disclosure does not grant any license under IP rights
- No obligation to enter a further commercial relationship
- No representation as to accuracy of disclosed information

## A.9 — Governing law / venue / dispute resolution

- Venue convenient for the requester
- Carve-out for **injunctive relief in any court of competent
  jurisdiction** — confidentiality breaches need same-day TROs;
  arbitration is too slow
- Jury waiver, class-action waiver — standard for commercial NDAs

## A.10 — NDA escalation triggers

Emit `:::escalation` if:

- The NDA is governed by **non-US law**
- The disclosure involves **regulated data** (PHI, financial, ITAR-
  controlled, classified) — industry-specific counsel required
- A dispute or threatened breach is already in motion
- The disclosure is in connection with a **public-company** M&A
  process (Reg FD / insider-trading exposure)

---

# Part B — MSA Review Checklist

## B.0 — Posture

- Is this a **template MSA** the requester is proposing, or a
  counterparty's paper they're marking up? Posture changes the
  redline aggressiveness.
- Is the MSA **paired with Order Forms / SOWs**? Every Order Form is
  a separate negotiation; the MSA's defaults flow down.
- **Industry-specific compliance attached**? (Data-processing
  addendum, BAA, security exhibit, SOC 2 attestation) — these are
  often where the real risk lives.

## B.1 — Scope, deliverables, SOW structure

- MSA defines the framework; SOWs / Order Forms define the deal
- Each SOW references the MSA and incorporates by reference
- Scope language tight: deliverables, acceptance criteria, milestones,
  acceptance period, deemed-acceptance trigger
- Flag: MSA terms that override SOW terms by default (or vice versa)
  — "in the event of conflict" clauses; clarify ordering

## B.2 — Fees, payment, taxes

- Fixed fee / time-and-materials / subscription / per-unit
- Payment terms (net-30 standard, net-60 acceptable for large
  enterprise, net-90+ flag)
- Late fees (1.0–1.5% per month standard)
- Currency, taxes, withholding
- True-up / overage mechanism for usage-based pricing
- Flag: unilateral price increases without notice + opt-out

## B.3 — IP

- **Pre-existing IP** — each party retains its own; license to use
  for performance only
- **Work product** — assignment to the customer (typical for
  services) OR license-back to vendor (for productized work);
  pre-existing IP carve-out required
- **Feedback** — vendor often takes a perpetual, royalty-free license
  to feedback; customer should narrow if feedback could be sensitive
- **Open-source** — vendor reps that no copyleft license contaminates
  customer-deliverable code; customer requires SBOM disclosure on
  request

## B.4 — Warranties

- **Services warranty** — performed in workmanlike manner per SOW;
  remedy = re-perform OR refund (capped)
- **IP non-infringement warranty** — vendor warrants delivered work
  doesn't infringe third-party IP; tied to indemnity obligation
- **Compliance warranty** — vendor complies with applicable law in
  performance
- **Data-security warranty** — vendor maintains commercially
  reasonable safeguards; references the security exhibit
- Flag: blanket "AS-IS" disclaimers in services agreements; missing
  IP non-infringement warranty

## B.5 — Indemnification

- **IP infringement** — vendor indemnifies customer; customer
  cooperates; vendor controls defense; injunctive remedy if work
  enjoined
- **Confidentiality breach** — mutual; uncapped (or carved out from
  LoL cap)
- **Data-security breach** — vendor indemnifies for breach caused by
  vendor; tied to security exhibit
- **Third-party claims** — mutual, scoped to claims arising from
  each party's conduct
- Flag: one-way IP indemnity from customer to vendor; missing data-
  security indemnity in services involving customer data

## B.6 — Limitation of liability (LoL)

- **Cap** — typically 1–3× fees paid in 12 months preceding the
  claim; uncapped categories below
- **Excluded categories** — indirect, consequential, lost profits,
  lost data
- **Carve-outs that punch through cap** — gross negligence, willful
  misconduct, IP infringement, indemnity obligations,
  confidentiality breach, breach of data-security obligations
- Flag: cap below 1× fees; no carve-outs; consequential-damages
  exclusion that swallows direct damages from data breach

## B.7 — Term / termination

- **Initial term** — typically 1–3 years for SaaS; 12 months for
  services
- **Auto-renewal** — flag without notice + opt-out
- **Termination for convenience** — buyer should have it; vendor's
  TfC typically restricted
- **Termination for cause** — material breach + cure period (30 days
  standard); insolvency event is auto-terminate
- **Effect of termination** — data return / destruction obligations;
  license survival of pre-existing IP; payment acceleration on
  customer's TfC

## B.8 — Confidentiality

- Often a separate exhibit or incorporates the NDA by reference
- Survival period (5 years standard; indefinite for trade secrets)
- See NDA checklist above for clause-by-clause review

## B.9 — Compliance, audit rights, reps

- **Compliance with law** — both parties; mutual
- **Customer audit right** — limited to compliance with the contract;
  reasonable notice; not more than annually
- **SOC 2 / ISO 27001 / equivalent attestation** — vendor delivers
  on request; customer relies in lieu of direct audit (common for
  enterprise SaaS)
- **Sub-processor flow-down** — vendor binds sub-processors to
  equivalent terms

## B.10 — Dispute resolution

- Governing law (typically Delaware or NY for US enterprise)
- Venue (state and federal courts in <governing-law state>)
- Arbitration provider / seat / rules / language (if elected)
- Class-action waiver, jury waiver
- Injunctive-relief carve-out for IP / confidentiality breaches

## B.11 — MSA escalation triggers

Emit `:::escalation` if:

- The MSA touches a regulated industry (healthcare-clinical,
  financial services, defense, insurance, broker-dealer)
- A dispute or threatened breach is already in motion
- The deal involves cross-border data transfer to a non-adequate
  jurisdiction without a recognized transfer mechanism
- The customer is signing today (binding-execution moment)

## B.12 — MSA cross-handoff to auditor

If, while reviewing the MSA, you observe:

- The vendor's referenced SOC 2 / ISO 27001 attestation is **stale
  or scope-mismatched**
- The data-security exhibit references controls that are **not
  evidenced** in the attestation
- The audit-rights clause is **denied or hollowed out** (e.g. "no
  right of inspection")
- **Sub-processor flow-down is missing or weaker than the MSA's own
  obligations**

Cross-handoff to auditor per `coordination-protocol.md` section 2c
to scope a controls walkthrough on the vendor.

---

## Output

Wrap the review as a single `:::artifact` block per the contract-
redline output shape, with all checklist items marked `OK / FLAG /
MISSING` and proposed redlines for FLAG / MISSING items.
