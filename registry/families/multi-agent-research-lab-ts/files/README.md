# multi-agent-research-lab-ts

Curated cross-domain research lab template — Lab Director +
Physics / Chemistry / Biology Researchers, with hand-tuned
interdisciplinary handoff protocols.

## Roles

- **Lab Director** — research-question formulation, dispatch, and
  cross-domain synthesis. Default respondent.
- **Physics Researcher** — arxiv / OpenAlex / Crossref. Owns
  experimental design with statistical power.
- **Chemistry Researcher** — Crossref / OpenAlex / PubChem /
  ChemSpider / RSC / ACS. Owns reaction mechanisms.
- **Biology Researcher** — UniProt / PDB / NCBI / OpenAlex /
  Crossref. Owns structural and bioinformatics context.

## Differentiating value

The interesting work in modern science crosses disciplinary lines.
A naive multi-agent bot either (a) hands every question to a single
"all of science" generalist that fabricates citations from
disciplines it does not own, or (b) routes a question to one
specialist that quietly answers outside its corpus.

This template solves both failures with an explicit
cross-domain handoff protocol:

1. The Director dispatches each question to a primary domain role.
2. The role pulls from its own corpus only.
3. When the retrieved literature crosses into another role's
   territory, the role MUST emit a `:::handoff` block — never
   absorb cross-domain context silently.
4. The Director synthesises with **role + citation attribution on
   every claim**, surfaces contradictions explicitly, and
   refuses to ship a synthesis with a fabricated or missing
   citation.

See `coordination-protocol.md` for the full mechanism, with worked
examples for chem-bio, bio-physics, and chem-physics handoffs.

## Files

- `coordination-protocol.md` — cross-domain dispatch + handoff +
  synthesis protocol.
- `agent-roster.json` — role registry with default respondent,
  responsibilities, delegation graph.
- `roles/lab-director/` — Director's system prompt + methodology
  (research-question-formulation, cross-domain-synthesis,
  literature-triage).
- `roles/physics-researcher/` — Physics system prompt +
  methodology (arxiv-literature-search, experimental-design).
- `roles/chemistry-researcher/` — Chemistry system prompt +
  methodology (reaction-mechanism-analysis,
  crossref-literature-search).
- `roles/biology-researcher/` — Biology system prompt + methodology
  (protein-structure-analysis, bioinformatics-survey).

## Advisory only — what this lab is NOT

This lab does not, in any combination of roles, replace:

- Peer review.
- Institutional review board (IRB).
- Institutional biosafety committee (IBC) or Dual-Use Research
  oversight.
- Lab safety officer / institutional EHS.
- Licensed physician or clinical pharmacologist.
- Patent counsel or technology transfer office.
- Regulatory affairs.

When a request crosses any of these lines, every role emits an
`:::escalation` block and refuses the part of the question that
crosses the line. The Director surfaces escalations in the
synthesis.

## Deployment

Composes against the `agent-base:tangle`, `agent-base:secure`,
`agent-tools:research-corpus`, and `agent-output:blocks` layers.
Deploy on Cloudflare Workers with the Tangle runtime. Set
`TANGLE_ROUTER_KEY`.
