// MIT — adapted from nanoclaw (https://github.com/qwibitai/nanoclaw)
//
// Discord channel adapter. Verifies Ed25519 signatures on every inbound
// interaction (Discord requirement — unverified requests get an immediate
// 401), parses interaction or MESSAGE_CREATE payloads, and sends replies
// via the REST API.
//
// Setup:
//  1. https://discord.com/developers/applications → New Application.
//  2. Bot tab → reset token → DISCORD_BOT_TOKEN.
//  3. General Information → Public Key → DISCORD_PUBLIC_KEY (hex).
//  4. Set Interactions Endpoint URL to <your-https-url>/channels/discord.
//     Discord PINGs that URL once with type=1; we respond with type=1.

import { createPublicKey, verify } from 'node:crypto'

const API = 'https://discord.com/api/v10'
const SIG_HEADER = 'x-signature-ed25519'
const TS_HEADER = 'x-signature-timestamp'

export interface DiscordInbound {
  chatId: string
  text: string
  sender: string
}

interface DiscordInteraction {
  type: number
  data?: { name?: string; options?: Array<{ name: string; value: unknown }> }
  channel_id?: string
  member?: { user?: { id: string; username: string; global_name?: string } }
  user?: { id: string; username: string; global_name?: string }
}

interface DiscordMessageCreate {
  t?: 'MESSAGE_CREATE'
  d?: {
    channel_id: string
    content: string
    author: { id: string; username: string; global_name?: string; bot?: boolean }
  }
}

function botToken(): string {
  const t = process.env.DISCORD_BOT_TOKEN
  if (!t) throw new Error('DISCORD_BOT_TOKEN not set')
  return t
}

function publicKey(): string {
  const k = process.env.DISCORD_PUBLIC_KEY
  if (!k) throw new Error('DISCORD_PUBLIC_KEY not set')
  return k
}

/** Verify the Ed25519 signature Discord stamps on every interaction.
 *  Public key is a 32-byte hex string; signature is a 64-byte hex string;
 *  payload is `${timestamp}${rawBody}`. */
function verifyEd25519(rawBody: string, sigHex: string, ts: string, pubKeyHex: string): boolean {
  if (sigHex.length !== 128 || pubKeyHex.length !== 64) return false
  // Wrap raw 32-byte Ed25519 public key in a SubjectPublicKeyInfo DER prefix
  // so node:crypto's KeyObject API will accept it. Prefix is fixed for Ed25519.
  const prefix = Buffer.from('302a300506032b6570032100', 'hex')
  const der = Buffer.concat([prefix, Buffer.from(pubKeyHex, 'hex')])
  const key = createPublicKey({ key: der, format: 'der', type: 'spki' })
  const data = Buffer.from(`${ts}${rawBody}`, 'utf8')
  const sig = Buffer.from(sigHex, 'hex')
  return verify(null, data, key, sig)
}

/** Parse an inbound Discord webhook (interaction or gateway forward).
 *  Returns null for PING (Discord verification handshake — caller responds
 *  with `{type:1}`), bot-authored messages, and non-text events. */
export async function receive(req: Request): Promise<DiscordInbound | null> {
  const sig = req.headers.get(SIG_HEADER)
  const ts = req.headers.get(TS_HEADER)
  const raw = await req.text()
  if (!sig || !ts || !verifyEd25519(raw, sig, ts, publicKey())) {
    throw new Error('discord: signature verification failed')
  }
  const body = JSON.parse(raw) as DiscordInteraction & DiscordMessageCreate
  if (body.type === 1) return null // PING
  if (body.type === 2 && body.data && body.channel_id) {
    const u = body.member?.user ?? body.user
    const text = (body.data.options ?? [])
      .map((o) => `${o.name}=${String(o.value)}`)
      .join(' ')
      .trim()
    return {
      chatId: body.channel_id,
      text: text ? `/${body.data.name} ${text}` : `/${body.data.name ?? 'cmd'}`,
      sender: u?.global_name ?? u?.username ?? u?.id ?? 'unknown',
    }
  }
  if (body.t === 'MESSAGE_CREATE' && body.d && !body.d.author.bot) {
    return {
      chatId: body.d.channel_id,
      text: body.d.content,
      sender: body.d.author.global_name ?? body.d.author.username,
    }
  }
  return null
}

/** Send a message to a Discord channel. Throws on non-2xx so the agent's
 *  HTTP layer can log it (Discord's body carries `code` + `message`). */
export async function send(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${API}/channels/${chatId}/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bot ${botToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content: text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`discord postMessage ${res.status}: ${body.slice(0, 200)}`)
  }
}

export const channelMeta = {
  id: 'discord' as const,
  envVars: ['DISCORD_BOT_TOKEN', 'DISCORD_PUBLIC_KEY'] as const,
  inbound: 'webhook' as const,
  outbound: 'POST' as const,
}
