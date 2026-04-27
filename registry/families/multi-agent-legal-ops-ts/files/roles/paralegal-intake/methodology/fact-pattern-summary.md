# Fact-pattern summary

The fact-pattern summary is the single most important artifact intake
produces. It is the only piece of the requester's narrative that
counsel or auditor sees. It rides inside the `:::handoff` packet and
persists across the matter.

## Format

A single prose block, ≤300 words, structured in this order:

1. **Who** — the requester (role / function only; never a personal
   name in the persisted summary), the counterparty (legal name or
   `redacted`), any other named parties (regulator, third-party
   service provider, sub-processor, vendor)
2. **What** — the matter in one sentence, then the operative
   document(s) by type (NDA, MSA, SOC 2 control narrative, vendor
   security questionnaire) with version where given
3. **When** — the timeline that matters: when the contract is
   intended to take effect; when the audit period begins/ends; when
   the regulator's deadline falls; when the requester needs the
   draft
4. **Where** — only when material: governing-law jurisdiction (state
   / federal / non-US), system geography for an audit (region /
   tenant), regulator (which one)
5. **Why now** — what triggered the request: counterparty proposed,
   regulator inquiry, suspected control failure, internal-audit
   fieldwork start, etc.
6. **Open questions** — the fields the requester could not provide
   (governing law unknown, deal size TBD, framework version unclear)

## Hard rules

- **PII redacted before persistence.** Run `redactPII` on the
  composed summary. If `assertNoPII` fails, emit `:::pii-blocked`
  (do NOT silently retry with a redacted version)
- **No legal characterization.** Intake summarizes facts. Phrases
  like "this is unenforceable", "this is a material weakness", "this
  is fraud" do NOT appear in the summary — they are counsel's or
  auditor's call, post-handoff
- **No counterparty quotation.** Quoted contract language in the
  fact-pattern leaks privilege-adjacent content; counsel reads the
  contract directly. Reference clauses by section number, not by
  text
- **No auditor's hypothesis.** Intake does not propose a finding-
  class; auditor frames the work in the framework after handoff
- **One sentence summarizes; multiple sentences detail.** The
  receiving role must be able to understand the matter from the
  first sentence alone, then read the rest for detail

## Allowed and required

- Functional roles (e.g. "the requester is the General Counsel's
  office"; "the counterparty is a SaaS vendor")
- Document types and versions (e.g. "MSA v3, dated 2026-03-15;
  Order Form #4 attached")
- Aggregates (e.g. "annual contract value: $2-5M range")
- Timeline anchors (e.g. "counterparty signature deadline:
  2026-05-12")
- Stated scope (e.g. "audit period 2025-Q4 ending 2025-12-31")
- Open-question list (≤5 items)

## Forbidden

- Personal names (use functional roles)
- Email addresses, phone numbers, SSNs, credit-card numbers, API
  keys, IP addresses (the privacy layer's structured detectors
  redact these; the summary should never need them)
- Attorney-client privileged communication from a different matter
  (intake asks the requester not to share)
- Speculation about counterparty motive
- Legal conclusions

## Example (fictional, US-leaning)

> The requester (General Counsel's office) is reviewing an MSA from
> a SaaS vendor (counterparty `redacted`) ahead of a 2026-Q2 rollout.
> The operative documents are MSA v3 (2026-03-15) and Order Form #4
> (annual fees $2-5M range). Governing law: Delaware (proposed by
> counterparty). The trigger: counterparty's signature deadline is
> 2026-05-12; requester has not yet redlined. Material open
> questions: (1) deal-size category (counterparty redline of LoL cap
> still pending), (2) whether Order Form #4 references a
> data-processing addendum (DPA not attached), (3) requester's
> internal data-classification of the records the vendor will
> process. Conflict check cleared per requester confirmation; no
> prior representation, no business relationship outside this MSA.

## When to ask for more

If the requester's narrative leaves a Required field unanswered,
ask via `:::question` — pause, do not invent. The hand-off packet
must not carry inferred fields.

## When to escalate without summarizing

If, while building the summary, you discover a hard-escalation
trigger (active litigation, criminal-law adjacency, binding-decision
imminent, regulated industry, fraud indicator), STOP and emit
`:::escalation`. Do not finish the summary; do not hand off. The
trigger is the response.
