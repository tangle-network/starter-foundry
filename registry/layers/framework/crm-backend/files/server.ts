import http from 'node:http'
import { createCompany, createContact, getCompany, getContact } from './api/contacts.js'
import { createDeal, logActivity, moveDealStage } from './api/pipeline.js'
import { pipelineValue, winRate, wonAmountByMonth } from './api/reporting.js'

const port = Number.parseInt(process.env.PORT ?? '8104', 10)

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: process.env.SERVICE_NAME ?? 'starter-foundry-crm' }))
    return
  }

  if (url.pathname === '/api/contacts' && request.method === 'POST') return createContact(request, response)
  const contactMatch = /^\/api\/contacts\/([^/]+)$/.exec(url.pathname)
  if (contactMatch && request.method === 'GET') return getContact(request, response, contactMatch[1]!)

  if (url.pathname === '/api/companies' && request.method === 'POST') return createCompany(request, response)
  const companyMatch = /^\/api\/companies\/([^/]+)$/.exec(url.pathname)
  if (companyMatch && request.method === 'GET') return getCompany(request, response, companyMatch[1]!)

  if (url.pathname === '/api/deals' && request.method === 'POST') return createDeal(request, response)
  const dealStageMatch = /^\/api\/deals\/([^/]+)\/stage$/.exec(url.pathname)
  if (dealStageMatch && request.method === 'PATCH') return moveDealStage(request, response, dealStageMatch[1]!)

  if (url.pathname === '/api/activities' && request.method === 'POST') return logActivity(request, response)

  if (url.pathname === '/api/reports/won-by-month' && request.method === 'GET') return wonAmountByMonth(request, response)
  if (url.pathname === '/api/reports/pipeline-value' && request.method === 'GET') return pipelineValue(request, response)
  if (url.pathname === '/api/reports/win-rate' && request.method === 'GET') return winRate(request, response)

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'not found' }))
})

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`${process.env.SERVICE_NAME ?? 'starter-foundry-crm'} listening on ${port}`)
})
