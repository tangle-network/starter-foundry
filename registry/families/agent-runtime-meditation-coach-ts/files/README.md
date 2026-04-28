# Meditation Coach Agent

A voice-first meditation coach agent bundle for guided sessions, technique cues, and mindfulness check-ins.

## Features

- Guided meditation sessions (breath awareness, body scan, loving-kindness, etc.)
- Technique cues for specific practices
- Mindfulness check-ins
- Voice-first interaction via phony-voice layer

## Usage

Deploy to Cloudflare Workers with the Tangle runtime. Set the following environment variables:

- `TANGLE_API_KEY`
- `PHONY_API_KEY`

## Routes

- `POST /api/chat` — Main chat endpoint (bearer auth)
- `GET /api/health` — Health check

## Disclaimer

This agent is not a licensed therapist, doctor, or mental health professional. It is a meditation coach for healthy adults. Do not use as a substitute for professional medical or mental health treatment.
