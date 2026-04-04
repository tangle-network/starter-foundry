import { createLogger } from './logger'

const logger = createLogger('error-handler')
const isProduction = () => process.env.NODE_ENV === 'production'

interface ErrorResponseBody {
  error: string
  requestId?: string
  status: number
}

export function errorHandler(
  err: Error & { statusCode?: number; status?: number },
  req: { headers?: Record<string, string | string[] | undefined> } & Record<string, unknown>,
  res: { statusCode: number; json: (body: ErrorResponseBody) => void },
  _next: () => void,
) {
  const status = err.statusCode ?? err.status ?? 500
  const requestId =
    (req as any).requestId ??
    (req.headers?.['x-request-id'] as string | undefined)

  logger.error(err.message, {
    stack: err.stack,
    status,
    ...(requestId && { requestId }),
  })

  res.statusCode = status
  res.json({
    error: isProduction() && status >= 500 ? 'Internal Server Error' : err.message,
    ...(requestId && { requestId }),
    status,
  })
}
