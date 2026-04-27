# TOOLS — agent-runtime-cs-research-ts

The bundle inherits all primitives from `agent-base:secure`: `secrets`, `workspace`, `webhook-in`, `webhook-out`, `schedule`, `identity`, `audit`. Plus generic agent tools: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `WebFetch`.

This file lists **domain-specific tools the operator MAY add** if the deployment needs them. Each entry is intent — not implementation. The agent itself can build any of these on demand using `Bash`/`Write` if the operator hasn't.

## Research corpus (inherited from `agent-tools:research-corpus`)

| Capability | Intent |
|---|---|
| `corpus.arxiv(query)` | arXiv paper search |
| `corpus.semanticScholar(query)` | Semantic Scholar |
| `corpus.openalex(query)` | OpenAlex |
| `corpus.crossref(query)` | Crossref DOI metadata |

## Domain tools the operator may want

Stub list — replace with role-specific entries. Keep ≤10 domain tools per deployment; more is fragmentation. Each tool should be:
- Single-purpose
- JSON output
- ≤100 LOC
- Listed here when added

| Tool | Intent | Notes |
|---|---|---|
| `literature-survey` | Concrete tool implementing the `literature-survey` capability | Operator implements when needed |
| `paper-summarization` | Concrete tool implementing the `paper-summarization` capability | Operator implements when needed |
| `citation-graph-exploration` | Concrete tool implementing the `citation-graph-exploration` capability | Operator implements when needed |
| `research-question-formulation` | Concrete tool implementing the `research-question-formulation` capability | Operator implements when needed |

## Build a new tool when you need it

The agent's job includes building tools when the measurement doesn't exist. New tools should be small, JSON-output, single-purpose. Add an entry here via PR after shipping.
