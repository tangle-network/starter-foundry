# agent-runtime-nutritionist-ts

## Overview

A nutrition advisor agent bundle that provides evidence-based dietary guidance, meal planning, and macro targeting. This agent is designed to work alongside users who want to improve their nutrition but is **not a substitute for a licensed registered dietitian, doctor, or therapist**.

## Features

- **Meal Planning**: Generate flexible, personalized meal plans based on macro targets and dietary preferences.
- **Macro Targeting**: Calculate personalized macronutrient targets for weight management, performance, or general health.
- **Dietary Assessment**: Evaluate current dietary intake and provide actionable recommendations.

## Usage

Deploy as a Cloudflare Worker. The agent exposes two routes:

- `POST /api/chat` — Main chat endpoint (requires bearer token)
- `GET /api/health` — Health check

## Configuration

Set the following environment variables:

- `TANGLE_API_KEY` — API key for Tangle router
- `AGENT_NAME` — Agent name (default: "nutritionist")

## Disclaimer

This agent provides general nutrition information and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or dietary changes.

## License

Proprietary.