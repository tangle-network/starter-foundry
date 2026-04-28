# Voice agent backend wiring

This folder is intentionally empty — the browser scaffold posts to three
routes and expects a backend you stand up yourself. Pick one stack, wire
the three handlers, point `vite.config.ts` proxy at it. Tangle Router
(`router.tangle.tools`) is recommended for the LLM call; STT and TTS need
their own providers.

## Contract

### `POST /api/stt`

**Request:** raw audio blob. `Content-Type` matches what `MediaRecorder`
produced (`audio/webm;codecs=opus` on Chrome/Firefox, `audio/mp4` on Safari).

**Response:**
```json
{ "text": "transcribed words here" }
```

Providers:

- **Whisper** via `openai` SDK: `openai.audio.transcriptions.create({ file, model: 'whisper-1' })`.
- **Deepgram** via REST: `POST https://api.deepgram.com/v1/listen` with the raw blob.
- **AssemblyAI** universal-streaming or `/v2/transcript`.
- **Self-hosted** `faster-whisper` in a sidecar container if you want zero per-call cost.

### `POST /api/llm`

**Request:**
```json
{ "transcript": "what the user said", "history": [...] }
```

**Response:**
```json
{ "reply": "what the agent says back" }
```

Use `router.tangle.tools` (set `TANGLE_API_KEY` on the server) so
you get provider failover and unified billing without vendor lock-in.

### `POST /api/tts`

**Request:**
```json
{ "text": "agent reply text" }
```

**Response:** raw audio bytes. `Content-Type: audio/mpeg` (mp3) is the safest
bet — every browser decodes it, and the `<audio>` element in `index.html`
plays it via `URL.createObjectURL(blob)`.

Providers:

- **ElevenLabs** `/v1/text-to-speech/{voice_id}` — lowest latency, best quality.
- **OpenAI TTS** `audio.speech.create({ model: 'tts-1', voice: 'nova', input })`.
- **Cartesia** `sonic` for sub-200ms first-chunk latency.
- **Piper** self-hosted if you want on-device synthesis.

## Minimum viable backend (Node, one file)

```ts
import express from 'express'
const app = express()

app.post('/api/stt', express.raw({ type: '*/*', limit: '20mb' }), async (req, res) => {
  // req.body is the audio Buffer
  // call your STT provider, return { text }
})

app.post('/api/llm', express.json(), async (req, res) => {
  // POST to https://router.tangle.tools/v1/chat/completions
  // return { reply }
})

app.post('/api/tts', express.json(), async (req, res) => {
  // call your TTS provider, stream bytes to res
  res.setHeader('content-type', 'audio/mpeg')
})

app.listen(8787)
```
