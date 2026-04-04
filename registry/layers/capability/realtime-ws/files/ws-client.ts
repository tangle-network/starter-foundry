import { useEffect, useRef, useCallback, useState } from 'react'
import type { WSMessage } from './ws-types'

type Handler = (data: unknown) => void

interface UseWebSocketOptions {
  autoReconnect?: boolean
  maxRetries?: number
}

interface UseWebSocketReturn {
  sendMessage: (event: string, data: unknown, room?: string) => void
  lastMessage: WSMessage | null
  readyState: number
  subscribe: (event: string, handler: Handler) => () => void
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoReconnect = true, maxRetries = 5 } = options
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(new Map<string, Set<Handler>>())
  const retriesRef = useRef(0)
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED)
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const unmountedRef = useRef(false)

  const connect = useCallback(() => {
    if (unmountedRef.current) return
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) return
      retriesRef.current = 0
      setReadyState(WebSocket.OPEN)
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      setReadyState(WebSocket.CLOSED)
      if (autoReconnect && retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000)
        retriesRef.current++
        setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (e) => {
      if (unmountedRef.current) return
      try {
        const msg: WSMessage = JSON.parse(e.data as string)
        setLastMessage(msg)
        const eventHandlers = handlersRef.current.get(msg.event)
        if (eventHandlers) {
          for (const h of eventHandlers) h(msg.data)
        }
      } catch { /* ignore malformed */ }
    }
  }, [url, autoReconnect, maxRetries])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((event: string, data: unknown, room?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSMessage = { event, data, room }
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const subscribe = useCallback((event: string, handler: Handler) => {
    if (!handlersRef.current.has(event)) handlersRef.current.set(event, new Set())
    handlersRef.current.get(event)!.add(handler)
    return () => {
      handlersRef.current.get(event)?.delete(handler)
    }
  }, [])

  return { sendMessage, lastMessage, readyState, subscribe }
}
