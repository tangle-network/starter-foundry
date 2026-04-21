import http from 'node:http'
import {
  classRoster,
  createAssignment,
  createClass,
  submitAssignment,
} from './api/classroom.ts'
import { gradeSubmission, studentGrades } from './api/gradebook.ts'

const port = Number.parseInt(process.env.PORT ?? '{{port}}', 10)

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: '{{serviceName}}' }))
    return
  }

  if (url.pathname === '/api/classes' && request.method === 'POST') {
    await createClass(request, response)
    return
  }
  const rosterMatch = /^\/api\/classes\/([^/]+)\/roster$/.exec(url.pathname)
  if (rosterMatch && request.method === 'GET') {
    await classRoster(request, response, rosterMatch[1] ?? '')
    return
  }
  const assignMatch = /^\/api\/classes\/([^/]+)\/assignments$/.exec(url.pathname)
  if (assignMatch && request.method === 'POST') {
    await createAssignment(request, response, assignMatch[1] ?? '')
    return
  }
  const submitMatch = /^\/api\/assignments\/([^/]+)\/submissions$/.exec(url.pathname)
  if (submitMatch && request.method === 'POST') {
    await submitAssignment(request, response, submitMatch[1] ?? '')
    return
  }
  const gradeMatch = /^\/api\/submissions\/([^/]+)\/grade$/.exec(url.pathname)
  if (gradeMatch && request.method === 'POST') {
    await gradeSubmission(request, response, gradeMatch[1] ?? '')
    return
  }
  const studentGradesMatch = /^\/api\/students\/([^/]+)\/grades$/.exec(url.pathname)
  if (studentGradesMatch && request.method === 'GET') {
    await studentGrades(request, response, studentGradesMatch[1] ?? '')
    return
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'not found' }))
})

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`{{serviceName}} listening on ${port}`)
})
