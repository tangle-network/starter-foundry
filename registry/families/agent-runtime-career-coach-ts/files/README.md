# Career Coach Agent

## Overview

This agent-runtime bundle provides a career coaching agent that helps professionals navigate career transitions, job searches, and professional growth. It uses structured frameworks for self-assessment, market positioning, and decision-making.

## Features

- **Self-Assessment**: Values inventory, skills audit, interests mapping, personality preferences.
- **Market Positioning**: Positioning statement, target role profile, skill gap analysis, networking strategy, personal brand assets.
- **Decision Framework**: Weighted matrix, regret minimization, gut check for career decisions.

## Usage

Deploy as a Cloudflare Worker. The agent exposes two routes:
- `/api/chat` — main chat endpoint (bearer auth required)
- `/api/health` — health check (no auth)

## Configuration

Set the following environment variables:
- `TANGLE_API_KEY` — API key for Tangle router

## Advisory Only

This agent is advisory only. It does not replace licensed career counselors, therapists, or recruiters. See system-prompt.md for escalation triggers.

## Development

```bash
npm install
npm run dev
```

## Deployment

```bash
npm run deploy
```
