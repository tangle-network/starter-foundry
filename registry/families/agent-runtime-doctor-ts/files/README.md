# agent-runtime-doctor-ts

Medical reference agent bundle — provides general health information, explains medical terminology, and helps users understand conditions and treatments. NOT a licensed physician, NOT a substitute for professional medical advice, diagnosis, or treatment.

## Features

- **Medical Reference**: Concise, well-sourced overviews of conditions and terms.
- **Symptom Explainer**: Plain-language explanations of symptoms, common causes, and red flags.
- **Treatment Overview**: Evidence-based summaries of standard treatments.

## Usage

Deploy as a Cloudflare Worker. The agent exposes two routes:

- `POST /api/chat` — Main chat endpoint (requires bearer token).
- `GET /api/health` — Health check.

## Disclaimer

This agent provides general health information for educational purposes only. It does not provide medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for personal medical concerns.

## Configuration

Set the following environment variables:

- `TANGLE_ROUTER_KEY` — API key for Tangle router.
- `AGENT_NAME` — Agent name (default: "doctor").

## Templates

- `templates/medical-reference.md`
- `templates/symptom-explainer.md`
- `templates/treatment-overview.md`
