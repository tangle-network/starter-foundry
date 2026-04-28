# CS Research Assistant Agent Bundle

## Overview
A Cloudflare Worker agent that assists with computer science research: literature surveys, paper summarization, citation-graph exploration, and research-question formulation. Uses the research-corpus layer (arxiv, Semantic Scholar, OpenAlex, Crossref) for citation-grounded responses.

## Includes
- agent-base:tangle
- agent-tools:research-corpus
- agent-output:blocks

## Capabilities
- literature-survey
- paper-summarization
- citation-graph-exploration
- research-question-formulation

## Routes
- `POST /api/chat` — Bearer auth, calls research tools
- `GET /api/health` — No auth

## Environment Variables
- `TANGLE_API_KEY` (required)
- `AGENT_NAME` (public)

## Usage
Deploy to Cloudflare Workers with the provided wrangler.toml. The agent runs in a Tangle sandbox with no new privileges and all capabilities dropped by default.

## Templates
- `templates/literature-survey.md`
- `templates/paper-summarization.md`
- `templates/citation-graph-exploration.md`
- `templates/research-question-formulation.md`

## License
MIT