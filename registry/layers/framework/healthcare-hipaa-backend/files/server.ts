import http from 'node:http'
import { createPatient, getPatient } from './api/patients.ts'
import { createEncounter, getEncounter } from './api/encounters.ts'

const port = Number.parseInt(process.env.PORT ?? '8100', 10)

// Only the /health probe is unauthenticated. Every /api/* route runs through
// withPhiAccess which requires auth headers + writes an audit log row.
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: 'starter-foundry-healthcare' }))
    return
  }

  if (url.pathname === '/api/patients' && request.method === 'POST') {
    await createPatient(request, response)
    return
  }
  if (url.pathname.startsWith('/api/patients/') && request.method === 'GET') {
    await getPatient(request, response)
    return
  }

  if (url.pathname === '/api/encounters' && request.method === 'POST') {
    await createEncounter(request, response)
    return
  }
  if (url.pathname.startsWith('/api/encounters/') && request.method === 'GET') {
    await getEncounter(request, response)
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'not found' }))
})

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`starter-foundry-healthcare listening on ${port}`)
})
