import { routes } from './handlers.ts'

const port = Number(Deno.env.get('PORT') ?? '{{port}}')

Deno.serve({ port, hostname: '0.0.0.0' }, (request) => {
  const url = new URL(request.url)
  const handler = routes[url.pathname]
  if (handler) return handler(request)
  return new Response('not found', { status: 404 })
})

console.log(`{{serviceName}} listening on http://localhost:${port}`)
