type Handler = (request: Request) => Response | Promise<Response>

interface HealthPayload {
  status: 'ok'
  service: string
  database: string
  sdk: string
  runtime: 'deno'
}

function health(): Response {
  const payload: HealthPayload = {
    status: 'ok',
    service: '{{serviceName}}',
    database: '{{databaseProvider}}',
    sdk: Deno.env.get('SDK_PROVIDER') ?? 'none',
    runtime: 'deno',
  }
  return Response.json(payload)
}

export const routes: Record<string, Handler> = {
  '/health': health,
}
