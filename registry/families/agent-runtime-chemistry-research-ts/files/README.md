# agent-runtime-chemistry-research-ts

Chemistry Research Assistant agent bundle — literature search, reaction planning, and compound data extraction.

## Overview

This bundle provides a chemistry research assistant that helps chemists, students, and researchers find, organize, and interpret chemical information. It composes the agent-runtime substrate with the research-corpus layer (PubChem, ChemSpider, RSC, ACS) so every claim is citation-grounded.

## Capabilities

- **literature-search**: Systematic search of peer-reviewed chemical literature.
- **reaction-planning**: Suggest known reaction pathways with cited literature support.
- **compound-data-extraction**: Retrieve structured physicochemical, spectral, and hazard data.

## Usage

Deploy on Cloudflare Workers with the Tangle runtime. Set the `TANGLE_ROUTER_KEY` environment variable.

## Advisory Only

This agent is advisory only. It does not replace a licensed chemist, lab safety officer, or regulatory professional. Always consult appropriate professionals for safety, regulatory, or clinical decisions.

## Files

- `system-prompt.md` — Agent system prompt with role, boundaries, and methodology.
- `templates/` — Methodology templates for each capability.
- `wrangler.toml` — Cloudflare Workers configuration.
- `README.md` — This file.
