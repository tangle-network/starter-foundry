# NDA Review Checklist

**DRAFT — NOT LEGAL ADVICE.** Use this as a structured first pass.
Final language for any binding execution must be reviewed by
bar-licensed counsel.

## Step 0 — Posture

- **Mutual or unilateral?** If only one party is disclosing, a
  unilateral NDA is normal; once both parties expect to share,
  mutualize. Default-redline unilateral → mutual when the
  relationship is exploratory (partnership talks, M&A diligence both
  ways, vendor-evaluation where the vendor sees the buyer's roadmap).
- **Standalone NDA or NDA-within-MSA?** If embedded, check for
  conflict with the MSA's own confidentiality clause (survival
  period, return-of-info obligations).

## 1. Definition of "Confidential Information"

- Does it cover **all forms** — written, oral, visual, electronic,
  observed?
- Does it require **marking** as confidential to qualify? Marking
  requirements weaken protection for oral / observed disclosures.
  Acceptable variant: oral disclosures must be confirmed in writing
  within 30 days.
- Does it sweep in **derivative work product** (notes, analyses,
  summaries the recipient creates from disclosed material)? Should.
- Does it cover the **fact of discussions** (existence, status,
  terms)? Important for M&A and partnership talks.

## 2. Exclusions from confidentiality

Standard exclusions (recipient should insist on all five):
- Already known to recipient before disclosure
- Independently developed without use of confidential info
- Lawfully received from a third party with no duty of confidence
- In the public domain through no fault of recipient
- Required to be disclosed by law / court order (with prompt notice
  + cooperation in seeking protective order)

Flag: missing "independently developed" exclusion (this is the most
commonly stripped); missing prompt-notice requirement on legal-order
disclosures.

## 3. Term

Two terms to distinguish:
- **Term of the NDA** (during which disclosures are protected)
- **Confidentiality period** (during which the recipient must keep
  protected info confidential — often longer)

Market: 2–5 year confidentiality period for general business info;
**indefinite for trade secrets**. Flag: a single term that expires
the protection of trade secrets after a fixed window.

## 4. Permitted uses

- Tightly scoped to the **stated purpose** (e.g. "evaluating a
  potential commercial relationship") — not "any business purpose."
- **Need-to-know** restriction inside the recipient's organization.
- **Affiliate / contractor** sharing only with equivalent
  confidentiality obligations bound in writing.

## 5. Return / destruction of information

- Upon written request **or** termination, recipient returns or
  destroys.
- **Certification of destruction** in writing if destroyed.
- **Carve-outs**: legal-hold copies, automated-backup copies (with
  ongoing confidentiality obligation) — these are reasonable.

## 6. Residuals clause

Recipient often pushes for a residuals clause: information retained
in unaided memory of personnel may be used freely. **High-value
disclosers should resist or narrow** — limit to general skills and
know-how, exclude trade secrets and specific technical information.

## 7. Equitable remedies

- Acknowledgment that breach causes irreparable harm
- Right to seek **injunctive relief without bond** (or with nominal
  bond)
- Without limiting other remedies (not sole-and-exclusive)

## 8. No license / no obligation

- Disclosure does not grant any license under IP rights
- No obligation to enter a further commercial relationship
- No representation as to accuracy of disclosed information (subject
  to MSA reps if there's a downstream deal)

## 9. Governing law / venue / dispute resolution

- Venue convenient for the user
- Carve-out for **injunctive relief in any court of competent
  jurisdiction** — confidentiality breaches need same-day TROs;
  arbitration is too slow.
- Jury waiver, class-action waiver — standard for commercial NDAs.

## 10. Boilerplate

- Assignment (no assignment without consent; change-of-control
  triggers consent)
- Severability, entire agreement, amendment in writing
- Counterparts / electronic signature

## Escalation triggers

Emit `:::escalation` if any of the following:
- The NDA is governed by **non-US law**
- The disclosure involves **regulated data** (PHI, financial, ITAR-
  controlled, classified) — industry-specific counsel required
- A dispute or threatened breach is already in motion
- The disclosure is in connection with a **public-company** M&A
  process (Reg FD / insider-trading exposure)

## Output

Wrap as a single `:::artifact` block tagged
`DRAFT — NOT LEGAL ADVICE` with each checklist item marked
`OK / FLAG / MISSING` and proposed redlines for FLAG / MISSING items.
