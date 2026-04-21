import type { IncomingMessage, ServerResponse } from 'node:http'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { patients } from '../db/schema.ts'
import { decryptPhi, encryptPhi } from '../encryption.ts'
import { withPhiAccess } from './phi-access.ts'

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

export const getPatient = withPhiAccess(
  'read',
  'patient',
  (request) => {
    const url = new URL(request.url ?? '', 'http://localhost')
    return url.pathname.split('/').pop() ?? null
  },
  async (_request, response, ctx) => {
    if (!ctx.resourceId) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'patient id required' }))
      return
    }
    const rows = await db.select().from(patients).where(eq(patients.id, ctx.resourceId)).limit(1)
    const row = rows[0]
    if (!row) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'patient not found' }))
      return
    }
    // Minimum-necessary filtering by role — billing doesn't get SSN.
    const body: Record<string, unknown> = {
      id: row.id,
      mrn: row.mrn,
      sex: row.sex,
      name: decryptPhi(row.encryptedName),
      dob: decryptPhi(row.encryptedDob),
    }
    if (ctx.actor.role === 'clinician' || ctx.actor.role === 'admin') {
      body.ssn = decryptPhi(row.encryptedSsn)
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  },
)

export const createPatient = withPhiAccess(
  'create',
  'patient',
  () => null,
  async (request, response, ctx) => {
    if (ctx.actor.role === 'billing' || ctx.actor.role === 'patient') {
      response.writeHead(403, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'role cannot create patient records' }))
      return
    }
    const body = (await readJsonBody(request)) as {
      mrn?: string
      name?: string
      dob?: string
      ssn?: string
      sex?: 'M' | 'F' | 'X'
    } | null
    if (!body?.mrn || !body.name || !body.dob) {
      response.writeHead(422, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'mrn, name, dob are required' }))
      return
    }
    const [inserted] = await db
      .insert(patients)
      .values({
        mrn: body.mrn,
        encryptedName: encryptPhi(body.name)!,
        encryptedDob: encryptPhi(body.dob)!,
        encryptedSsn: encryptPhi(body.ssn ?? null),
        sex: body.sex ?? null,
      })
      .returning({ id: patients.id, mrn: patients.mrn })
    response.writeHead(201, { 'content-type': 'application/json' })
    response.end(JSON.stringify(inserted))
  },
)
