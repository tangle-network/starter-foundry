# agent-runtime-biology-research-ts

Biology research assistant agent bundle — literature search, sequence /
structure analysis, and experimental design support. Composes the
agent-runtime substrate with the research-corpus layer (PubMed/Entrez,
Semantic Scholar, OpenAlex, Crossref) and authoritative biology
databases (NCBI, UniProt, Ensembl) so every claim is citation-grounded.

**Advisory only.** Never replaces IRB, IACUC, IBC, peer review, a
genetic counselor, or a credentialed PI's judgment.

## What's in this bundle

- `system-prompt.md` — role, output blocks, escalation triggers,
  research-corpus and sequence-data discipline.
- `methodology/literature-search.md` — MeSH-aware PubMed-first search,
  evidence-tier filtering, citation discipline, PRISMA scope limits.
- `methodology/sequence-analysis.md` — accession echo, version pinning,
  database routing (NCBI / UniProt / Ensembl / PDB / dbSNP / gnomAD),
  sandbox-safe vs heavy-tool boundary.
- `methodology/experimental-design.md` — hypothesis pinning,
  confounder enumeration, controls, power calculation, ARRIVE 2.0
  alignment, pre-registration, escalation triggers for IRB/IACUC/IBC.
- `methodology/index.json` — capability → file map.

## Composition

Suggested layers (Tangle stack floor):

- `agent-base/tangle` — sandbox-sdk + tcloud + router
- `agent-tools/research-corpus` — arxiv / Semantic Scholar / OpenAlex /
  Crossref / Entrez
- `agent-output/blocks` — `:::artifact`, `:::survey`, `:::escalation`

## Routing

Tier-1 keyword: `biology-research-agent`. The router prefers this
bundle when a user asks about biology literature, sequence analysis,
gene/protein lookup, or experimental design in a wet-lab context.

## Stability

Bundle ships methodology as the source of truth. Edits to
`methodology/*.md` flow to deployed agents at next deploy; do not
hardcode methodology into the system prompt — it bypasses the version
trail.
