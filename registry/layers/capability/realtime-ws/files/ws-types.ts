export interface WSMessage {
  event: string
  data: unknown
  room?: string
  senderId?: string
}

export interface WSConnection {
  id: string
  ws: WebSocket
  rooms: Set<string>
  metadata: Record<string, unknown>
  alive: boolean
}

export interface WSServerOptions {
  heartbeatMs?: number
  maxConnections?: number
}

export const WSEvent = {
  JOIN: 'room:join',
  LEAVE: 'room:leave',
  MESSAGE: 'room:message',
  PRESENCE: 'room:presence',
  ERROR: 'error',
  PONG: 'pong',
} as const

export type WSEventType = (typeof WSEvent)[keyof typeof WSEvent]
