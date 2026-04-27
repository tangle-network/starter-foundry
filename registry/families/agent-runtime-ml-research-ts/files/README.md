# ML Research Assistant Agent

## Overview
An agent-runtime bundle that provides ML research assistance: literature review, experiment design, and result interpretation. Uses the research-corpus layer for citation-grounded responses.

## Capabilities
- **literature-review**: Systematic literature surveys with citation grounding.
- **experiment-design**: Rigorous experiment planning with baselines and statistical rigor.
- **result-interpretation**: Honest interpretation of results, including limitations.

## Usage
Deploy on Cloudflare Workers with the Tangle runtime. Set `TANGLE_ROUTER_KEY` in environment variables.

## Routes
- `POST /api/chat` — Main chat endpoint (bearer auth).
- `GET /api/health` — Health check.

## Disclaimer
This agent is advisory only. It does not replace peer review, domain expertise, or professional judgment.
