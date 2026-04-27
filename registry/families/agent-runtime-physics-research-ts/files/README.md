# Physics Research Assistant Agent

An agent-runtime bundle for physics research assistance: literature search, citation analysis, and experimental design support.

## Features

- **Literature Search**: Query arxiv, Semantic Scholar, OpenAlex, and Crossref for relevant papers.
- **Citation Analysis**: Analyze citation networks and impact metrics.
- **Experimental Design**: Help design physics experiments with clear hypotheses and controls.

## Usage

Deploy as a Cloudflare Worker. Set the `TANGLE_ROUTER_KEY` environment variable. The agent exposes two routes:

- `POST /api/chat` — Main chat endpoint (requires bearer token)
- `GET /api/health` — Health check

## Templates

- `templates/literature-search.md` — Systematic literature search protocol
- `templates/citation-analysis.md` — Citation network analysis protocol
- `templates/experimental-design.md` — Experimental design protocol

## Disclaimer

This agent is advisory only. It does not replace peer review, ethics board approval, or professional judgment. Always verify results and consult appropriate professionals for high-stakes decisions.