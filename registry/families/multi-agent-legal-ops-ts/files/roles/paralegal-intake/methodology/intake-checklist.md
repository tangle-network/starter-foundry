# Intake checklist

Run this on every new matter before any hand-off. The checklist's job
is to extract the fields the receiving role (counsel or auditor)
needs to load the right methodology and apply the right disclaimer.

## Required fields

For every matter, capture these eight fields. Each is a single value;
prefer "unknown" over a guess.

| Field | Allowed values | Why it matters |
|---|---|---|
| `matter-type` | `contract-review` / `nda-review` / `msa-review` / `drafting` / `redline` / `regulatory-question` / `control-walkthrough` / `evidence-request` / `deficiency-write-up` / `framework-question` / `scoping` | Routes to counsel vs auditor; determines which methodology loads |
| `counterparty` | name (or `redacted` if PII-stripped) | Conflict-check input; counsel needs it to research market position |
| `governing-law-asked` | state / federal / non-US / unknown / N/A | Counsel-only; determines escalation threshold |
| `framework` | SOX / SOC2 / ISO27001 / NIST / PCI-DSS / HIPAA / other / N/A | Auditor-only; loads the right control catalogue |
| `period` | `YYYY-Q#` or `YYYY-MM-DD..YYYY-MM-DD` / N/A | Auditor-only; bounds the population |
| `deal-stage` | exploratory / drafting / redlining / pre-signature / post-signature / N/A | Counsel-only; pre-signature triggers binding-decision escalation |
| `binding-decision-imminent` | true / false | Counsel-only; if true, escalate to outside counsel |
| `regulated-industry` | none / healthcare-clinical / finserv-finra-sec / defense-itar / insurance / broker-dealer / utilities / cannabis / gambling | Either role; non-`none` triggers hard-escalation |

## Sequence

1. Surface the session disclaimer (system-prompt.md).
2. Ask the requester to describe the matter in one paragraph.
3. Map the description to the eight fields above. If a field is
   ambiguous, emit `:::question` and pause for the requester's answer.
4. If `regulated-industry` is non-`none` OR `binding-decision-imminent`
   is true, do NOT route to counsel/auditor — emit `:::escalation`.
5. If `matter-type` is auditor-shaped (control-walkthrough, evidence-
   request, deficiency-write-up, framework-question, scoping) OR the
   request mentions a framework, route to auditor.
6. Else, route to counsel.
7. Build the fact-pattern summary (`fact-pattern-summary.md`) and
   construct the `:::handoff` packet.

## Decision matrix — counsel vs auditor

| Request mentions … | Route to |
|---|---|
| Contract / NDA / MSA / SLA / redline / drafting | counsel |
| SOX / SOC2 / ISO27001 / NIST / PCI / HIPAA control / walkthrough / PBC / deficiency / control test / control sign-off / audit committee | auditor |
| Regulatory research (general principles) | counsel |
| Suspected control failure | auditor |
| Both — contract review of a vendor whose SOC 2 is the security control | counsel first; counsel cross-handoffs to auditor if material weakness suspected |

## Common intake failures

1. **Routing on a single keyword.** "compliance" alone is ambiguous —
   does the requester mean SOX compliance (auditor) or contractual
   compliance with a clause (counsel)? Ask before routing.
2. **Skipping the conflict check.** A clean intake without a conflict
   check is incomplete. Run conflict-check.md every matter.
3. **Letting the requester self-route.** Requester says "I want to
   talk to counsel." Run intake anyway. Counsel needs the packet.
4. **Persisting raw PII in the fact-pattern.** Use redactPII on every
   field before constructing the handoff packet. See section 5 of
   `coordination-protocol.md`.
5. **Asking for unrelated detail.** The intake checklist's eight
   fields are the floor; do not ask the requester for fifty fields
   "just in case." Counsel and auditor will surface their own
   `:::question` blocks.

## Output

When the eight fields are complete and the conflict check is cleared
(or flagged), emit a single `:::handoff` block per
`coordination-protocol.md` section 2a (counsel) or 2b (auditor). Do
not emit any other artifact — counsel and auditor produce the
substantive deliverables.
