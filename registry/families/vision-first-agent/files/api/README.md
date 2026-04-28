# Vision agent backend wiring

The browser scaffold posts a captured JPEG + user prompt to `/api/vision`.
You implement the endpoint.

## Contract

### `POST /api/vision`

**Request:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "prompt": "What am I looking at?"
}
```

**Response:**
```json
{
  "answer": "A laptop on a wooden desk with a half-full coffee mug to the right.",
  "boxes": [
    { "label": "laptop", "x": 0.18, "y": 0.32, "w": 0.55, "h": 0.48 },
    { "label": "mug",    "x": 0.76, "y": 0.45, "w": 0.15, "h": 0.20 }
  ]
}
```

The `boxes` array is optional — when present, the frontend draws them over
the captured frame. Coordinates are normalized 0..1 so they survive any
display-size rescaling. Most current multimodal models won't return boxes
reliably — omit the field and the frontend only renders `answer`.

## Providers

- **Anthropic Claude** (Sonnet 4.5+ has vision): `messages.create` with an
  `image` content block. Recommended — best captioning quality and the
  most reliable "please return boxes as JSON" follower.
- **OpenAI GPT-4o / GPT-4.1**: `chat.completions.create` with
  `{ type: 'image_url', image_url: { url: dataUrl } }`.
- **Google Gemini 2.x**: Files API or inline `inline_data`.
- **Router:** Route through `router.tangle.tools` to failover across
  providers without re-wiring the client.

## Minimum viable backend (Node)

```ts
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
app.use(express.json({ limit: '10mb' }))

const client = new Anthropic({
  baseURL: 'https://router.tangle.tools/anthropic',
  apiKey: process.env.TANGLE_API_KEY,
})

app.post('/api/vision', async (req, res) => {
  const { image, prompt } = req.body as { image: string; prompt: string }
  // image is a data URL; strip the prefix to get raw base64
  const base64 = image.replace(/^data:image\/\w+;base64,/, '')

  const result = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
  res.json({ answer: text })
})

app.listen(8787)
```

## Prompt tips

- Ask for "a short description (1-2 sentences)" — vision models default to
  long walls of text.
- For OCR: "Transcribe only the text visible in this image. Output exactly
  what appears, no commentary."
- For boxes: most models need JSON-mode enforcement. Tool use is the
  reliable path; pure "return JSON" prompts hallucinate.
