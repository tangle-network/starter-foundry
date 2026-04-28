# agent-runtime-photographer-ts

Creative photographer agent bundle — composition coaching, lighting setup design, and post-production workflow guidance.

## Overview

This agent works alongside a photographer as a thinking partner for shot planning, gear selection, and creative direction. It provides structured methodology for composition, lighting, and post-production without substituting for hands-on experience or professional critique.

## Capabilities

- **Composition coaching** — rule of thirds, leading lines, framing, depth, symmetry, negative space
- **Lighting setup design** — key/fill/backlight placement, modifiers, contrast ratios, color temperature
- **Post-production workflow** — import, basic adjustments, color grading, local adjustments, export

## Usage

Deploy on Cloudflare Workers with the Tangle agent-runtime substrate. The agent exposes two routes:
- `/api/chat` — authenticated chat endpoint (bearer token)
- `/api/health` — health check

## Configuration

Set the following environment variables:
- `TANGLE_API_KEY` — API key for Tangle router
- `AGENT_NAME` — agent name (default: photographer)

## Templates

- `templates/composition-canvas.md` — composition planning framework
- `templates/lighting-setup-design.md` — lighting setup design framework
- `templates/post-production-workflow.md` — post-production workflow framework

## License

MIT
