# MSA Review Checklist

**DRAFT — NOT LEGAL ADVICE.** Use this as a structured first pass.
Final language for any binding execution must be reviewed by
bar-licensed counsel in the operative jurisdiction.

## Step 0 — Posture

- **Form ownership** — are we redlining the buyer's MSA or the
  vendor's? Each party's form bakes in defaults that favor the
  drafter; identify which way each clause leans.
- **Deal size** — drives market position on LoL caps, indemnity, and
  termination rights. Sub-$100k SaaS uses much tighter caps than
  seven-figure professional services.
- **Industry** — healthcare (HIPAA BAA required), financial services
  (FINRA / SEC), defense (DFARS / ITAR flow-downs), insurance →
  escalate; industry counsel norms diverge.

## 1. Scope / SOW structure

- MSA + SOW model: MSA governs general terms; each SOW defines
  specific scope, fees, deliverables, schedule.
- **Order of precedence** clause — when MSA and SOW conflict, which
  controls? Default to MSA; allow SOW to override only for explicitly
  enumerated terms (fees, deliverables, schedule).
- **Change-order process** — who signs, what triggers a re-quote,
  default behavior on disputed change orders (work continues at
  original scope vs paused).

## 2. Payment terms

- **Net days** — net-30 standard for SaaS / professional services;
  net-60 / net-90 increasingly common from large buyers, push back
  to net-30 or build it into the price.
- **Late fees / interest** — 1.0–1.5%/month or max permitted by law;
  suspension rights after defined cure period.
- **Disputed invoices** — undisputed amounts must still be paid by
  the due date; disputed portions tracked separately with a
  written-notice + good-faith-resolution process.
- **Taxes** — fees exclusive of taxes; buyer responsible for sales /
  use / VAT; each party responsible for its own income taxes.
- **Expenses** — pre-approved, at-cost, with receipts.

## 3. IP — assignment vs license

- **Pre-existing IP** — each party retains its own; no implicit
  assignment.
- **Foreground IP** (created during the engagement) — who owns?
  - **Work-for-hire / assignment to buyer**: buyer owns deliverables;
    vendor needs a license-back for residual know-how to operate its
    business.
  - **License to buyer**: vendor retains ownership; buyer gets a
    perpetual, paid-up, sublicensable license for its intended use.
- **Feedback** — vendor typically requires a perpetual royalty-free
  license to use feedback in its product roadmap.
- **Open-source** — disclosure obligation; copyleft (GPL / AGPL)
  exclusion unless pre-approved; obligation to comply with OSS
  license terms.
- **Moral rights waiver** — required in jurisdictions that recognize
  moral rights; defer to counsel for non-US deals.

## 4. Indemnification

- **Vendor indemnifies buyer** for: third-party IP-infringement
  claims, breach of confidentiality, breach of data-security
  obligations, gross negligence / willful misconduct.
- **Buyer indemnifies vendor** for: misuse of deliverables, content
  buyer provides, third-party claims arising from buyer's data.
- **Mechanics** — prompt notice, control of defense by indemnitor
  with cooperation by indemnitee, no settlement without indemnitee
  consent for non-monetary obligations or admissions of fault, duty
  to mitigate.
- **IP-infringement carve-outs** — vendor not liable if claim arises
  from buyer's modifications, combination with non-vendor products,
  or use after notice to discontinue.
- **IP-infringement remedies** — vendor must (i) procure right to
  continue use, (ii) modify to non-infringing, or (iii) refund pro-
  rata fees + terminate.

## 5. Limitation of liability

- **Cap on direct damages** — common positions:
  - 1× fees paid in trailing 12 months (low-stakes SaaS)
  - 2–3× annual fees (material engagements)
  - Higher / uncapped for specific risk classes
- **Excluded categories** — indirect, consequential, special,
  incidental, punitive, lost profits, loss of data (push back on
  loss-of-data exclusion for data-handling vendors).
- **Carve-outs that punch through the cap** — push for ALL of:
  - Indemnification obligations (or at minimum, IP-infringement
    indemnity)
  - Breach of confidentiality
  - Breach of data-security / privacy obligations
  - Gross negligence, willful misconduct, fraud
  - Payment obligations
  - Violation of laws
- **Mutual or one-way?** Caps and carve-outs should be mutual; flag
  asymmetric framing.

## 6. Warranties

- **Services**: performed in a workmanlike manner consistent with
  industry standards; conformance to documentation; remedy =
  re-perform / refund.
- **IP non-infringement** — to vendor's knowledge or absolute (depends
  on leverage).
- **No malicious code** — no time bombs, drop-dead devices, viruses;
  no disabling devices triggered on payment dispute.
- **Disclaimers** — all other warranties disclaimed (merchantability,
  fitness for purpose, non-infringement beyond stated reps); flag
  blanket "AS-IS" disclaimers in vendor forms.

## 7. Confidentiality

- Cross-reference NDA checklist — same definitions, exclusions,
  return obligations, residuals position.
- **Survival** — confidentiality obligations survive termination
  (typically 3–5 years, indefinite for trade secrets).

## 8. Data security & privacy

- **Data Processing Addendum (DPA)** required for any vendor
  handling personal data — addresses GDPR / CCPA / state-privacy-law
  obligations, Standard Contractual Clauses for cross-border
  transfers, sub-processor approvals.
- **Security standards** — SOC 2 Type II / ISO 27001 / equivalent;
  encryption in transit + at rest; breach notification within
  defined window (24–72 hours common).
- **Audit rights** — annual SOC 2 report delivery, on-site audit
  rights for material engagements.
- **CCPA / Cal AB-1184** — California-specific consumer / health-
  privacy considerations; if California consumer data is in scope,
  escalate to counsel for state-specific terms.

## 9. Term & termination

- **Initial term** (often 1–3 years), **renewal** (auto-renewal with
  60–90 day non-renewal notice; flag unilateral auto-renewal).
- **Termination for convenience** — by buyer with 30–90 days notice;
  often no convenience-termination right for vendor in subscription
  deals.
- **Termination for cause** — material breach, 30-day cure period;
  insolvency, bankruptcy.
- **Effect of termination** — payment of fees through termination
  date, return / deletion of confidential info, license-survival
  carve-outs (perpetual licenses survive), data-extraction window.

## 10. Governing law / venue / dispute resolution

- Governing law without conflict-of-laws principles.
- Venue convenient for the user; or arbitration (AAA / JAMS,
  specified seat, specified rules, specified language).
- **Carve-out for injunctive relief** — confidentiality / IP
  breaches need court access.
- Jury waiver, class-action waiver — standard.

## 11. Insurance

- Commercial general liability ($1M / $2M aggregate)
- Professional liability / E&O ($1M / $5M depending on deal size)
- Cyber liability (rising baseline; $5M+ for material data handlers)
- Workers' comp (statutory)
- Vendor names buyer as additional insured where applicable.

## 12. Boilerplate

- Assignment (consent required; change-of-control triggers consent)
- Notices (method, address)
- Force majeure (does NOT excuse payment; pandemic / cyber-attack
  inclusion)
- Independent contractors (no employment / agency / partnership)
- Severability, entire agreement, amendment in writing, counterparts

## Escalation triggers

Emit `:::escalation` if any of the following:
- Healthcare (HIPAA BAA), financial services, defense, insurance,
  cannabis, gambling — industry-specific counsel required
- Non-US governing law / venue
- Public-company counterparty with disclosure obligations
- Already-noticed dispute, demand letter, or arbitration
- Choice-of-law / non-compete / employment-classification analysis
  requires state-specific expertise

## Output

Wrap as a single `:::artifact` block tagged
`DRAFT — NOT LEGAL ADVICE` with each section marked
`OK / FLAG / MISSING` and proposed redlines (with rationale + market
position) for FLAG / MISSING items.
