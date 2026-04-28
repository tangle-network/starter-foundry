# Multimodal agent backend wiring

The React client posts `multipart/form-data` to `/api/multimodal` with up
to three parts:

| field   | type       | required |
|---------|------------|----------|
| `text`  | string     | always present (may be empty) |
| `image` | File (JPEG/PNG/WebP) | optional |
| `audio` | File (audio/webm or audio/mp4) | optional |

Your backend extracts them, forwards to a multimodal LLM, and returns the
response. Streamed newline-delimited JSON works best — the client already
handles partial responses and renders as chunks arrive.

## Contract

### `POST /api/multimodal`

**Request:** `multipart/form-data` (set by `FormData`, don't force
`Content-Type` yourself — the browser picks the boundary).

**Response (non-streaming):**
```json
{ "reply": "the multimodal LLM's answer" }
```

**Response (streaming):** `text/plain` or `application/x-ndjson`, chunks of
`{"delta":"words as they arrive"}` separated by `\n`. The React client
flushes each arrival into `pre#out` as it lands.

## Provider recipes

### Anthropic Claude (recommended)

```ts
import Anthropic from '@anthropic-ai/sdk'
import express from 'express'
import multer from 'multer'

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const client = new Anthropic({
  baseURL: 'https://router.tangle.tools/anthropic',
  apiKey: process.env.TANGLE_API_KEY,
})

app.post('/api/multimodal', upload.fields([{ name: 'image' }, { name: 'audio' }]), async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[] | undefined>
  const image = files.image?.[0]
  const audio = files.audio?.[0]
  const text = (req.body.text as string | undefined) ?? ''

  const content: Anthropic.Messages.ContentBlockParam[] = []
  if (image) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimetype as 'image/jpeg' | 'image/png' | 'image/webp',
        data: image.buffer.toString('base64'),
      },
    })
  }
  if (audio) {
    // Claude's text API doesn't accept audio directly — run STT first
    // (Whisper, Deepgram) and append the transcript as text:
    //   const transcript = await transcribe(audio.buffer, audio.mimetype)
    //   content.push({ type: 'text', text: `[audio transcript] ${transcript}` })
  }
  content.push({ type: 'text', text: text || 'Describe what you see/hear.' })

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content }],
  })
  const reply = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  res.json({ reply })
})

app.listen(8787)
```

### OpenAI GPT-4o (image + audio natively)

GPT-4o-audio accepts audio blocks directly without STT:
```ts
messages: [{
  role: 'user',
  content: [
    { type: 'input_image', image_url: { url: imageDataUrl } },
    { type: 'input_audio', input_audio: { data: audioBase64, format: 'webm' } },
    { type: 'input_text', text },
  ],
}]
```

### Google Gemini 2.x

Accepts all three modalities in a single `parts` array. Use the Files API
for anything over ~5MB.

## Security

- Cap `multer` file sizes (20MB is reasonable for image+audio).
- Validate MIME type server-side — clients can lie about `Content-Type`.
- Never log the raw bytes. Image buffers can leak PII.
