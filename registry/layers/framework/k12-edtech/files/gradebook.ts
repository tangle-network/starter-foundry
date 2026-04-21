// Gradebook API. Every grade read writes a FERPA audit row BEFORE the grade
// is returned. Grade writes are not destructive: amendments are new rows
// that reference the prior grade via amendmentOfGradeId.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import {
  assignments,
  gradeAccessLogs,
  grades,
  parentStudents,
  submissions,
} from '../db/schema.ts'

interface Actor {
  id: string
  role: 'teacher' | 'admin' | 'parent' | 'student'
}

function resolveActor(request: IncomingMessage): Actor | null {
  const id = request.headers['x-actor-id']
  const role = request.headers['x-actor-role']
  if (typeof id !== 'string' || typeof role !== 'string') return null
  if (!['teacher', 'admin', 'parent', 'student'].includes(role)) return null
  return { id, role: role as Actor['role'] }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

async function logGradeAccess(params: {
  actor: Actor
  studentId: string
  assignmentId: string | null
  reason: string | undefined
  ipAddress: string | null
}): Promise<void> {
  await db.insert(gradeAccessLogs).values({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    studentId: params.studentId,
    assignmentId: params.assignmentId ?? null,
    reason: params.reason ?? null,
    ipAddress: params.ipAddress,
  })
}

/** Gate parent access to a student's grades via canAccessGrades AND custodial_rights. */
async function parentCanAccess(parentId: string, studentId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(parentStudents)
    .where(and(eq(parentStudents.parentId, parentId), eq(parentStudents.studentId, studentId)))
    .limit(1)
  const link = rows[0]
  return !!link && link.canAccessGrades && link.custodialRights
}

export async function gradeSubmission(
  request: IncomingMessage,
  response: ServerResponse,
  submissionId: string,
) {
  const actor = resolveActor(request)
  if (!actor || (actor.role !== 'teacher' && actor.role !== 'admin')) {
    response.writeHead(403, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'only teachers or admins can grade' }))
    return
  }
  const body = (await readJsonBody(request)) as {
    pointsEarned?: number
    letter?: 'A' | 'B' | 'C' | 'D' | 'F' | 'I' | 'P' | 'NP'
    comment?: string
    amendmentOfGradeId?: string
  } | null
  if (typeof body?.pointsEarned !== 'number') {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'pointsEarned required' }))
    return
  }
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1)
  if (!sub) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'submission not found' }))
    return
  }
  const [row] = await db
    .insert(grades)
    .values({
      submissionId,
      pointsEarned: body.pointsEarned,
      letter: body.letter ?? null,
      gradedByTeacherId: actor.id,
      comment: body.comment ?? null,
      amendmentOfGradeId: body.amendmentOfGradeId ?? null,
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function studentGrades(
  request: IncomingMessage,
  response: ServerResponse,
  studentId: string,
) {
  const actor = resolveActor(request)
  if (!actor) {
    response.writeHead(401, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'unauthenticated' }))
    return
  }

  if (actor.role === 'parent') {
    const allowed = await parentCanAccess(actor.id, studentId)
    if (!allowed) {
      response.writeHead(403, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'parent lacks access to this student (canAccessGrades/custodialRights gate)' }))
      return
    }
  } else if (actor.role === 'student' && actor.id !== studentId) {
    // Students may only see their own grades.
    response.writeHead(403, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'students can only view their own grades' }))
    return
  }

  // FERPA audit entry BEFORE returning grades.
  await logGradeAccess({
    actor,
    studentId,
    assignmentId: null,
    reason: (request.headers['x-access-reason'] as string | undefined) ?? undefined,
    ipAddress: (request.socket.remoteAddress ?? '').slice(0, 45) || null,
  })

  const rows = await db
    .select({
      gradeId: grades.id,
      submissionId: grades.submissionId,
      pointsEarned: grades.pointsEarned,
      letter: grades.letter,
      gradedAt: grades.gradedAt,
      comment: grades.comment,
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
      totalPoints: assignments.totalPoints,
    })
    .from(grades)
    .innerJoin(submissions, eq(grades.submissionId, submissions.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(submissions.studentId, studentId))
    .orderBy(desc(grades.gradedAt))

  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ studentId, grades: rows }))
}
