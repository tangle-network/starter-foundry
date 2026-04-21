import type { IncomingMessage, ServerResponse } from 'node:http'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { assignments, classes, enrollments, students, submissions } from '../db/schema.ts'

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

export async function createClass(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as {
    code?: string
    title?: string
    subject?: string
    academicYear?: string
    term?: string
    teacherId?: string
  } | null
  if (!body?.code || !body.title || !body.subject || !body.academicYear || !body.term || !body.teacherId) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'code, title, subject, academicYear, term, teacherId required' }))
    return
  }
  const [row] = await db
    .insert(classes)
    .values({
      code: body.code,
      title: body.title,
      subject: body.subject,
      academicYear: body.academicYear,
      term: body.term,
      teacherId: body.teacherId,
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function classRoster(
  _request: IncomingMessage,
  response: ServerResponse,
  classId: string,
) {
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      grade: students.grade,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(and(eq(enrollments.classId, classId), isNull(enrollments.droppedAt)))
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ classId, roster: rows }))
}

export async function createAssignment(
  request: IncomingMessage,
  response: ServerResponse,
  classId: string,
) {
  const body = (await readJsonBody(request)) as {
    title?: string
    description?: string
    totalPoints?: number
    dueAt?: string
  } | null
  if (!body?.title || typeof body.totalPoints !== 'number') {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'title and totalPoints required' }))
    return
  }
  const [row] = await db
    .insert(assignments)
    .values({
      classId,
      title: body.title,
      description: body.description ?? null,
      totalPoints: body.totalPoints,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function submitAssignment(
  request: IncomingMessage,
  response: ServerResponse,
  assignmentId: string,
) {
  const body = (await readJsonBody(request)) as {
    studentId?: string
    content?: string
    attachments?: Array<{ uri: string; filename: string }>
  } | null
  if (!body?.studentId) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'studentId required' }))
    return
  }
  const [row] = await db
    .insert(submissions)
    .values({
      assignmentId,
      studentId: body.studentId,
      content: body.content ?? null,
      attachments: body.attachments ?? [],
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}
