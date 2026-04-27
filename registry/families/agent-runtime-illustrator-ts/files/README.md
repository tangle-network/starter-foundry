# agent-runtime-illustrator-ts

Creative illustrator agent bundle — art direction, visual style development, and composition guidance.

## Overview

This agent helps users sharpen their visual ideas, explore composition and color, and develop a consistent illustration style. It is an advisory tool, not a substitute for a professional art director or illustrator.

## Capabilities

- **art-direction**: Structured brief creation and visual direction alignment.
- **style-development**: Systematic exploration and definition of illustration style.
- **composition-guide**: Analysis and improvement of visual element arrangement.

## Usage

Deploy on Cloudflare Workers with the Tangle runtime. The agent exposes two routes:
- `/api/chat` — main interaction endpoint (bearer auth)
- `/api/health` — health check

## Templates

- `templates/art-direction-canvas.md`
- `templates/style-development.md`
- `templates/composition-guide.md`

## License

MIT
