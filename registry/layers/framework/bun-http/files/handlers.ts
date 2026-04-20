// Route handlers for the Bun HTTP starter. Extend by adding entries to the
// routes map; each handler receives the raw Request and returns Response.

type Handler = (request: Request) => Response | Promise<Response>

interface HealthPayload {
  status: 'ok'
  service: string
  database: string
  sdk: string
}

function health(): Response {
  const payload: HealthPayload = {
    status: 'ok',
    service: '{{serviceName}}',
    database: '{{databaseProvider}}',
    sdk: process.env.SDK_PROVIDER ?? 'none',
  }
  return Response.json(payload)
}

export const routes: Record<string, Handler> = {
  '/health': health,
}
