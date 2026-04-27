# Contract Redline (general method)

**DRAFT — NOT LEGAL ADVICE.** Use this as a structured first pass.
Final language for any binding execution must be reviewed by
bar-licensed counsel in the operative jurisdiction.

This is the general redline method. NDA- and MSA-specific checklists
live in `nda-msa-review.md`. Use this when the contract type is not
an NDA or MSA, or when running a category-by-category review on any
contract type.

## Step 0 — Open questions before drafting

Surface these as `:::question` and pause until the requester answers.
The intake handoff packet should already carry most; ask only for
missing fields.

- **Governing law / venue** — which state, which courts? (Materially
  changes enforceability of LoL caps, non-competes, indemnity scope.)
- **Counterparty type** — vendor / customer / partner / employee /
  contractor? Public-co / private / regulated?
- **Deal size** — informs market position on LoL caps (often 1× fees
  for low-stakes SaaS, 2–3× for material engagements, uncapped for
  IP / confidentiality breaches)
- **Industry** — healthcare-clinical, financial services, defense,
  insurance, cannabis, gambling → escalate; counsel norms diverge
  sharply
- **Posture** — paper-on-paper negotiation or one-shot signature?
  Are we proposing the form or marking up theirs?

## Step 1 — Read by clause category, not line-by-line

Group clauses; asymmetric provisions stand out faster category-by-
category than top-to-bottom.

1. **Commercials** — fees, payment terms, late fees, currency, taxes,
   true-up / overage. Flag: net-90+ payment terms, unilateral price
   increases, missing tax-allocation language.
2. **Scope / deliverables** — what is being bought / built /
   licensed? Reference the SOW or specs by version. Flag vague scope
   ("services as mutually agreed") — this is where disputes start.
3. **IP** — assignment vs license; pre-existing IP carve-outs;
   feedback / improvements ownership; open-source obligations;
   moral-rights waiver where applicable. Flag: blanket assignments
   that sweep in pre-existing IP, missing license-back to the
   creator, no carve-out for residual know-how.
4. **Indemnification** — triggers (third-party claims, IP
   infringement, breach of confidentiality, breach of reps), caps,
   carve-outs, defense-vs-indemnify split, control of defense, duty
   to mitigate, sole-and-exclusive remedy framing. Flag: one-way
   indemnity where market is mutual; missing IP-infringement carve-
   out from the LoL cap.
5. **Limitation of liability (LoL)** — cap (fixed dollar / multiple
   of fees / uncapped), excluded categories (indirect, consequential,
   lost profits), and carve-outs that punch through the cap (gross
   negligence, willful misconduct, IP infringement, indemnity
   obligations, confidentiality breach, breach of data-security
   obligations). Flag: caps below 1× fees, no carve-outs, "sole and
   exclusive remedy" framing without an indemnity escape hatch.
6. **Term / termination** — initial term, auto-renewal, termination
   for convenience (which side, notice period, fees due on
   termination), termination for cause (cure period, material-breach
   definition), effect-of-termination (data return, license survival,
   payment acceleration). Flag: auto-renewal without notice, no
   termination-for-convenience for the buyer, asymmetric cure
   periods.
7. **Dispute resolution** — governing law, venue, arbitration
   (provider, seat, rules, language), class-action waiver, jury
   waiver, injunctive-relief carve-out, fee-shifting. Flag: venue
   inconvenient for the requester, no injunctive-relief carve-out
   for IP / confidentiality.
8. **Boilerplate** — assignment (consent vs no consent on change of
   control), notices, force majeure, severability, entire agreement,
   amendment, counterparts, no-waiver. Flag: assignment without
   change-of-control consent, force majeure that excuses payment.

## Step 2 — Mark asymmetry explicitly

For every clause that runs only one way, propose mutualization with
rationale. Asymmetry is the single highest-yield finding in a first
pass: indemnity, reps & warranties, audit rights, termination rights,
notice cures.

## Step 3 — Propose redlines with rationale + market position

Each proposed redline gets:

- **Original language** (quoted by section number; do NOT quote raw
  text in the artifact for short clauses — reference + propose)
- **Proposed redline** (mark-up form)
- **Rationale** — what risk this addresses
- **Market position** — what's standard for deals of this type / size
- **Fallback** — acceptable counter-position if the counterparty
  resists

Without rationale + market position, redlines look like preference
fights and lose negotiating leverage.

## Step 4 — Cross-handoff to auditor

While reading the contract, watch for the four cross-handoff triggers
defined in `coordination-protocol.md` section 2c:

- Counterparty/client ICFR appears to have a material weakness
- Regulated-data flow without compliance attestation
- Financial-reporting impact
- Fraud indicators

When any fires, emit the cross-handoff packet AFTER finishing the
clause-by-category review. Counsel's redline is still the primary
artifact; the auditor handoff is additive.

## Step 5 — Hard-escalation triggers (emit `:::escalation`)

Any of these trigger a hard handoff to outside counsel:

- The contract touches a regulated industry (healthcare-clinical,
  financial services, defense, insurance, broker-dealer, regulated
  utilities, cannabis, gambling)
- The requester is signing today (binding-execution moment)
- A dispute, demand letter, or arbitration is already noticed
- Choice-of-law / venue analysis requires state-specific or non-US
  expertise
- Criminal-law touchpoints (export controls, sanctions, anti-bribery
  posture, white-collar exposure)
- Employment-classification questions (independent-contractor vs
  employee, ABC test by state)

## Output

Wrap the review as a single `:::artifact` block tagged
`DRAFT — NOT LEGAL ADVICE`, organized by the eight clause categories
(commercials, scope, IP, indemnification, LoL, term/termination,
dispute resolution, boilerplate), with the matching `:::escalation`
block whenever a trigger fires and the optional cross-handoff to
auditor when a section-2c trigger fires.

```
:::artifact
type: contract-redline
matter-id: <inherited from intake handoff>
disclaimer: DRAFT — NOT LEGAL ADVICE; jurisdiction-agnostic; final review by bar-licensed counsel
clauses:
  - category: commercials
    findings: <list>
    redlines: <list of {original, proposed, rationale, market, fallback}>
  - category: scope
    ...
  - category: ip
    ...
  - category: indemnification
    ...
  - category: lol
    ...
  - category: term-termination
    ...
  - category: dispute-resolution
    ...
  - category: boilerplate
    ...
asymmetry-summary: <list of one-way provisions and proposed mutualization>
:::
```
