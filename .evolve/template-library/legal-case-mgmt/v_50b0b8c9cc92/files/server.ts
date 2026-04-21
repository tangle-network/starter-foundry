import http from 'node:http'
import { getMatter, listUnbilledTime, logTimeEntry, openMatter } from './api/matter.ts'
import { draftInvoiceRoute } from './api/billing.ts'

const port = Number.parseInt(process.env.PORT ?? '{{port}}', 10)

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: '{{serviceName}}' }))
    return
  }

  if (url.pathname === '/api/matters' && request.method === 'POST') {
    await openMatter(request, response)
    return
  }

  const matterMatch = /^\/api\/matters\/([^/]+)$/.exec(url.pathname)
  if (matterMatch && request.method === 'GET') {
    await getMatter(request, response, matterMatch[1] ?? '')
    return
  }

  const timeMatch = /^\/api\/matters\/([^/]+)\/time-entries$/.exec(url.pathname)
  if (timeMatch && request.method === 'POST') {
    await logTimeEntry(request, response, timeMatch[1] ?? '')
    return
  }
  if (timeMatch && request.method === 'GET') {
    await listUnbilledTime(request, response, timeMatch[1] ?? '')
    return
  }

  const invoiceMatch = /^\/api\/matters\/([^/]+)\/invoice\/draft$/.exec(url.pathname)
  if (invoiceMatch && request.method === 'POST') {
    await draftInvoiceRoute(request, response, invoiceMatch[1] ?? '')
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'not found' }))
})

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`{{serviceName}} listening on ${port}`)
})
