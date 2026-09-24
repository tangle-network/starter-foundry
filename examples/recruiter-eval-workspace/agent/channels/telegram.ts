// MIT — adapted from nanoclaw (https://github.com/qwibitai/nanoclaw)
//
// Telegram channel adapter. Receives Bot API webhook updates and sends
// replies via sendMessage. The in-sandbox agent's HTTP server invokes
// receive() per webhook POST and send() to push a reply.
//
// Setup:
//  1. Talk to @BotFather, run /newbot, paste the token into TELEGRAM_BOT_TOKEN.
//  2. POST https://api.telegram.org/bot<TOKEN>/setWebhook with url=<your-https-url>.
//  3. Telegram POSTs JSON updates to that URL — pipe them into receive().

const API = 'https://api.telegram.org'

export interface TelegramInbound {
  chatId: string
  text: string
  sender: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
}

interface TelegramMessage {
  message_id: number
  chat: { id: number; type: string }
  text?: string
  caption?: string
  from?: { id: number; first_name?: string; username?: string }
}

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not set')
  return t
}

/** Parse a Telegram webhook POST. Returns null if it isn't a text message
 *  we can act on (sticker, photo without caption, service event, etc.). */
export async function receive(req: Request): Promise<TelegramInbound | null> {
  const update = (await req.json()) as TelegramUpdate
  const msg = update.message ?? update.edited_message ?? update.channel_post
  if (!msg) return null
  const text = msg.text ?? msg.caption
  if (!text) return null
  const sender = msg.from?.first_name ?? msg.from?.username ?? `chat:${msg.chat.id}`
  return { chatId: String(msg.chat.id), text, sender }
}

/** Send a text reply. Throws on non-2xx so the agent's HTTP layer can
 *  surface the failure (Telegram's error body has a useful description). */
export async function send(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${API}/bot${token()}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`telegram sendMessage ${res.status}: ${body.slice(0, 200)}`)
  }
}

export const channelMeta = {
  id: 'telegram' as const,
  envVars: ['TELEGRAM_BOT_TOKEN'] as const,
  inbound: 'webhook' as const,
  outbound: 'POST' as const,
}
