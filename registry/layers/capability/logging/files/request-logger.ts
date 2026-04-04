import { createLogger, generateRequestId, type Logger } from './logger'

const SKIP_PATHS = new Set(['/health', '/ready'])

interface RequestLike {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
}

interface ResponseLike {
  statusCode: number
}

interface ContextLike {
  logger?: Logger
  requestId?: string
}

export function requestLogger(service = 'http') {
  const logger = createLogger(service)

  return (req: RequestLike, res: ResponseLike, next: () => void) => {
    const path = new URL(req.url, 'http://localhost').pathname
    if (SKIP_PATHS.has(path)) return next()

    const requestId =
      (req.headers['x-request-id'] as string) ?? generateRequestId()
    const reqLogger = logger.withRequestId(requestId)
    const start = performance.now()

    const ctx = req as unknown as ContextLike
    ctx.logger = reqLogger
    ctx.requestId = requestId

    const originalEnd = (res as any).end
    ;(res as any).end = function (...args: unknown[]) {
      const duration = Math.round(performance.now() - start)
      reqLogger.info(`${req.method} ${path} ${res.statusCode}`, {
        method: req.method,
        path,
        status: res.statusCode,
        duration,
      })
      return originalEnd.apply(this, args)
    }

    next()
  }
}

export type { RequestLike, ResponseLike, ContextLike }
