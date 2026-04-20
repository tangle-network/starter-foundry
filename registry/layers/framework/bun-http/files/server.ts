import { routes } from './handlers'

const port = Number(process.env.PORT ?? '{{port}}')

const server = Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url)
    const handler = routes[url.pathname]
    if (handler) return handler(request)
    return new Response('not found', { status: 404 })
  },
})

console.log(`{{serviceName}} listening on http://${server.hostname}:${server.port}`)
