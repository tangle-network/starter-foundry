import type { IncomingMessage, ServerResponse } from 'node:http'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { encounters } from '../db/schema.ts'
import { decryptPhi, encryptPhi } from '../encryption.ts'
import { withPhiAccess } from './phi-access.ts'

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

export const getEncounter = withPhiAccess(
  'read',
  'encounter',
  (request) => {
    const url = new URL(request.url ?? '', 'http://localhost')
    return url.pathname.split('/').pop() ?? null
  },
  async (_request, response, ctx) => {
    if (!ctx.resourceId) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'encounter id required' }))
      return
    }
    const rows = await db.select().from(encounters).where(eq(encounters.id, ctx.resourceId)).limit(1)
    const row = rows[0]
    if (!row) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'encounter not found' }))
      return
    }
    // Billing role sees codes for claims but not clinical notes (minimum-necessary).
    const body: Record<string, unknown> = {
      id: row.id,
      patientId: row.patientId,
      providerId: row.providerId,
      encounteredAt: row.encounteredAt,
      cptCode: row.cptCode,
      icd10Codes: row.icd10Codes,
    }
    if (ctx.actor.role === 'clinician' || ctx.actor.role === 'admin') {
      body.notes = decryptPhi(row.encryptedNotes)
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  },
)

export const createEncounter = withPhiAccess(
  'create',
  'encounter',
  () => null,
  async (request, response, ctx) => {
    if (ctx.actor.role !== 'clinician' && ctx.actor.role !== 'admin') {
      response.writeHead(403, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'only clinicians can create encounters' }))
      return
    }
    const body = (await readJsonBody(request)) as {
      patientId?: string
      providerId?: string
      encounteredAt?: string
      notes?: string
      cptCode?: string
      icd10Codes?: string[]
    } | null
    if (!body?.patientId || !body.providerId || !body.encounteredAt) {
      response.writeHead(422, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'patientId, providerId, encounteredAt required' }))
      return
    }
    const [inserted] = await db
      .insert(encounters)
      .values({
        patientId: body.patientId,
        providerId: body.providerId,
        encounteredAt: new Date(body.encounteredAt),
        encryptedNotes: encryptPhi(body.notes ?? null),
        cptCode: body.cptCode ?? null,
        icd10Codes: body.icd10Codes ?? [],
      })
      .returning({ id: encounters.id })
    response.writeHead(201, { 'content-type': 'application/json' })
    response.end(JSON.stringify(inserted))
  },
)
