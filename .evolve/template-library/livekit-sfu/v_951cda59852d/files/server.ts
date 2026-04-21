// LiveKit SFU control plane.
//
// The SFU itself runs in docker (`docker compose up -d`). This Express server
// is the thin trusted boundary that mints access tokens: browser clients call
// POST /token with a desired room + identity, we sign a JWT using the same
// key/secret the SFU is configured with, and the client uses that JWT to
// open a WebSocket into the SFU.
//
// Keep all signing server-side. Never ship the API secret to the browser.

import express from 'express'
import { AccessToken, type VideoGrant } from 'livekit-server-sdk'

const controlPort = Number(process.env.CONTROL_PORT ?? '{{controlPort}}')
const apiKey = process.env.LIVEKIT_API_KEY ?? '{{livekitApiKey}}'
const apiSecret = process.env.LIVEKIT_API_SECRET ?? '{{livekitApiSecret}}'
const wsUrl = process.env.LIVEKIT_WS_URL ?? 'ws://localhost:{{port}}'

// HMAC key must be ≥32 bytes or the LiveKit server refuses to accept tokens
// signed by it. Fail-closed at boot rather than mint unusable JWTs.
if (apiSecret.length < 32) {
  throw new Error(
    `LIVEKIT_API_SECRET must be ≥32 bytes (got ${apiSecret.length}). ` +
      `Generate one with: openssl rand -base64 32`,
  )
}

interface TokenRequest {
  room: string
  identity: string
  // Optional grants — default is publish+subscribe on the named room.
  canPublish?: boolean
  canSubscribe?: boolean
  canPublishData?: boolean
  ttlSeconds?: number
}

const app = express()
app.use(express.json({ limit: '16kb' }))

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: '{{serviceName}}',
    wsUrl,
    apiKey,
  })
})

app.post('/token', (req, res) => {
  const body = req.body as Partial<TokenRequest>
  if (!body.room || typeof body.room !== 'string') {
    return res.status(400).json({ error: 'room is required (string)' })
  }
  if (!body.identity || typeof body.identity !== 'string') {
    return res.status(400).json({ error: 'identity is required (string)' })
  }

  const ttl = Math.min(Math.max(body.ttlSeconds ?? 6 * 60 * 60, 60), 24 * 60 * 60)

  const at = new AccessToken(apiKey, apiSecret, {
    identity: body.identity,
    ttl,
  })

  const grant: VideoGrant = {
    room: body.room,
    roomJoin: true,
    canPublish: body.canPublish ?? true,
    canSubscribe: body.canSubscribe ?? true,
    canPublishData: body.canPublishData ?? true,
  }
  at.addGrant(grant)

  return at.toJwt().then((jwt) => {
    res.json({ token: jwt, wsUrl, room: body.room, identity: body.identity, ttl })
  })
})

app.listen(controlPort, () => {
  console.log(`{{serviceName}} control plane on http://localhost:${controlPort}`)
  console.log(`  SFU WebSocket:   ${wsUrl}`)
  console.log(`  Mint token:      POST /token  { room, identity }`)
})
