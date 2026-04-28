# agent-runtime-mediator-ts

Voice-first mediator / conflict-coach agent bundle. Facilitates structured dialogue, de-escalation protocols, and agreement drafting for interpersonal and small-group conflicts.

## Features

- **Structured dialogue**: guided conversation with ground rules, active listening, and interest-based negotiation.
- **De-escalation**: techniques to reduce emotional intensity and prevent escalation.
- **Agreement drafting**: clear, specific, actionable agreements.
- **Voice-first**: optimized for voice interaction via phony-voice layer.

## Usage

Deploy as a Cloudflare Worker. Routes:
- `POST /api/chat` — main chat endpoint (bearer auth)
- `GET /api/health` — health check

## Configuration

Set environment variables:
- `TANGLE_API_KEY` — Tangle router key
- `PHONY_API_KEY` — Phony voice API key

## Disclaimer

This agent is **not** a licensed therapist, lawyer, or professional mediator. It is a coaching tool for informal conflicts. For legal, HR, or clinical situations, seek appropriate professional help.

## License

MIT