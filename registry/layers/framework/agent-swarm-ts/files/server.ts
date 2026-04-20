// Minimal HTTP server that drives the swarm. POST /run with {task} to execute.

import { createServer } from 'node:http'
import { buildSwarm } from './supervisor'

const swarm = buildSwarm()
const port = Number(process.env['PORT'] ?? '{{port}}')

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: '{{serviceName}}', orchestrator: 'langgraph' }))
    return
  }
  if (req.method === 'POST' && req.url === '/run') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { task?: string }
    if (!payload.task) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'task is required' }))
      return
    }
    const final = await swarm.invoke({ task: payload.task, nextAgent: 'researcher' })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ draft: final.draft, notes: final.notes, messages: final.messages }))
    return
  }
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('not found')
})

server.listen(port, () => {
  console.log(`{{serviceName}} listening on http://localhost:${port}`)
})
