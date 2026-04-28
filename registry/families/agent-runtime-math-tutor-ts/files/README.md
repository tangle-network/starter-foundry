# Math Tutor Agent

A voice-first math tutor agent bundle for calculus, algebra, and general math tutoring. Provides step-by-step explanations, adaptive problem generation, and concept explanations.

## Features
- Step-by-step solutions
- Adaptive problem generation
- Concept explanations
- Voice-first interaction (via phony-voice layer)

## Usage

### Chat API
`POST /api/chat`
- Requires Bearer token authentication
- Calls tools: problem-generator, step-by-step, concept-explainer

### Health Check
`GET /api/health`
- No authentication required

## Configuration

### Environment Variables
- `TANGLE_API_KEY`: API key for Tangle router
- `AGENT_NAME`: Name of the agent (default: math-tutor)

### Allowed Domains
- `api.tangle.tools`

## Templates
- `templates/problem-generation.md`: Generates practice problems
- `templates/step-by-step-solution.md`: Provides step-by-step solutions
- `templates/concept-explanation.md`: Explains mathematical concepts

## Disclaimer
This agent is not a substitute for a certified math teacher or exam proctor. It is designed to assist with learning and practice.
