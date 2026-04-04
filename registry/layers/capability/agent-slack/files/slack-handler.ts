import { createHmac, timingSafeEqual } from 'crypto'

// Types

export interface SlackEvent {
  type: 'message' | 'app_mention' | 'reaction_added'
  channel: string
  user?: string
  text?: string
  thread_ts?: string
  ts: string
  reaction?: string
  item?: { type: string; channel: string; ts: string }
}

export interface SlackMessage {
  channel: string
  text: string
  thread_ts?: string
  mrkdwn?: boolean
}

interface ParsedCommand {
  command: string
  args: string[]
  raw: string
}

interface EventResponse {
  type: SlackEvent['type']
  channel: string
  threadTs?: string
  text?: string
  reaction?: string
  user?: string
}

// Implementation

export function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string,
): boolean {
  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) return false

  const baseString = `v0:${timestamp}:${body}`
  const computed = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex')

  const expected = Buffer.from(computed, 'utf8')
  const actual = Buffer.from(signature, 'utf8')
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export function handleEvent(event: SlackEvent): EventResponse {
  switch (event.type) {
    case 'message':
      return {
        type: 'message',
        channel: event.channel,
        threadTs: event.thread_ts,
        text: event.text,
        user: event.user,
      }

    case 'app_mention':
      return {
        type: 'app_mention',
        channel: event.channel,
        threadTs: event.thread_ts ?? event.ts,
        text: event.text,
        user: event.user,
      }

    case 'reaction_added':
      return {
        type: 'reaction_added',
        channel: event.item?.channel ?? event.channel,
        reaction: event.reaction,
        user: event.user,
      }
  }
}

export function formatSlackMessage(agentReply: string): string {
  let text = agentReply

  // Convert markdown bold **text** to Slack bold *text*
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*')

  // Convert markdown inline code (already compatible)

  // Convert markdown fenced code blocks to Slack format
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '```$2```')

  // Convert markdown links [text](url) to Slack format <url|text>
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')

  // Convert markdown headers ## to bold
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '*$1*')

  // Convert markdown unordered lists to Slack bullets
  text = text.replace(/^[-*]\s+/gm, '\u2022 ')

  // Convert markdown strikethrough ~~text~~ to Slack ~text~
  text = text.replace(/~~(.+?)~~/g, '~$1~')

  return text
}

export function parseCommand(text: string): ParsedCommand | null {
  // Strip bot mention (<@UXXXXX>) from the beginning
  const cleaned = text.replace(/^<@\w+>\s*/, '').trim()
  if (cleaned.length === 0) return null

  const parts = cleaned.split(/\s+/)
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)

  return { command, args, raw: cleaned }
}
