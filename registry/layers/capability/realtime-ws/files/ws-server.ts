import { WebSocketServer, WebSocket, type IncomingMessage } from 'ws'
import { randomUUID } from 'crypto'
import type { WSConnection, WSMessage, WSServerOptions } from './ws-types'

export function createWSServer(options: WSServerOptions = {}) {
  const heartbeatMs = options.heartbeatMs ?? 30_000
  const maxConnections = options.maxConnections ?? 1000
  const connections = new Map<string, WSConnection>()
  const rooms = new Map<string, Set<string>>()

  const wss = new WebSocketServer({ noServer: true })

  const heartbeat = setInterval(() => {
    for (const [id, conn] of connections) {
      if (!conn.alive) {
        disconnect(id)
        continue
      }
      conn.alive = false
      conn.ws.ping()
    }
  }, heartbeatMs)

  wss.on('close', () => clearInterval(heartbeat))

  function onConnection(ws: WebSocket, req: IncomingMessage) {
    if (connections.size >= maxConnections) {
      ws.close(1013, 'max connections reached')
      return
    }

    const id = randomUUID()
    const conn: WSConnection = { id, ws, rooms: new Set(), metadata: {}, alive: true }
    connections.set(id, conn)

    ws.on('pong', () => {
      const c = connections.get(id)
      if (c) c.alive = true
    })

    ws.on('message', (raw) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString())
        msg.senderId = id
        handleMessage(id, msg)
      } catch {
        sendTo(id, 'error', { message: 'invalid message format' })
      }
    })

    ws.on('close', () => disconnect(id))

    sendTo(id, 'connected', { socketId: id })
    return id
  }

  function handleMessage(socketId: string, msg: WSMessage) {
    switch (msg.event) {
      case 'room:join':
        if (typeof msg.room === 'string') joinRoom(socketId, msg.room)
        break
      case 'room:leave':
        if (typeof msg.room === 'string') leaveRoom(socketId, msg.room)
        break
      case 'room:message':
        if (typeof msg.room === 'string') broadcast(msg.room, msg.event, msg.data, socketId)
        break
    }
  }

  function joinRoom(socketId: string, room: string) {
    const conn = connections.get(socketId)
    if (!conn) return
    if (!rooms.has(room)) rooms.set(room, new Set())
    rooms.get(room)!.add(socketId)
    conn.rooms.add(room)
    broadcast(room, 'room:presence', { socketId, action: 'joined' })
  }

  function leaveRoom(socketId: string, room: string) {
    const conn = connections.get(socketId)
    if (!conn) return
    rooms.get(room)?.delete(socketId)
    conn.rooms.delete(room)
    if (rooms.get(room)?.size === 0) rooms.delete(room)
    broadcast(room, 'room:presence', { socketId, action: 'left' })
  }

  function broadcast(room: string, event: string, data: unknown, exclude?: string) {
    const members = rooms.get(room)
    if (!members) return 0
    let sent = 0
    for (const id of members) {
      if (id === exclude) continue
      if (sendTo(id, event, data, room)) sent++
    }
    return sent
  }

  function sendTo(socketId: string, event: string, data: unknown, room?: string): boolean {
    const conn = connections.get(socketId)
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return false
    const msg: WSMessage = { event, data, room, senderId: socketId }
    conn.ws.send(JSON.stringify(msg))
    return true
  }

  function disconnect(socketId: string) {
    const conn = connections.get(socketId)
    if (!conn) return
    for (const room of conn.rooms) {
      rooms.get(room)?.delete(socketId)
      if (rooms.get(room)?.size === 0) rooms.delete(room)
      broadcast(room, 'room:presence', { socketId, action: 'disconnected' })
    }
    if (conn.ws.readyState === WebSocket.OPEN) conn.ws.close()
    connections.delete(socketId)
  }

  return { wss, onConnection, joinRoom, leaveRoom, broadcast, sendTo, connections, rooms }
}
