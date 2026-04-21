import type { IncomingMessage, ServerResponse } from 'node:http'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { matters, parties, timeEntries } from '../db/schema.ts'

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

export async function openMatter(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as {
    clientId?: string
    matterNumber?: string
    title?: string
    practiceArea?: string
    opposingParties?: Array<{ name: string; contact?: Record<string, string> }>
  } | null
  if (!body?.clientId || !body.matterNumber || !body.title) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'clientId, matterNumber, title required' }))
    return
  }
  // NOTE: conflicts check not implemented — do not ship without one.
  const result = await db.transaction(async (tx) => {
    const [matter] = await tx
      .insert(matters)
      .values({
        clientId: body.clientId!,
        matterNumber: body.matterNumber!,
        title: body.title!,
        practiceArea: body.practiceArea ?? null,
      })
      .returning()
    if (!matter) throw new Error('Matter not found')
    if (body.opposingParties?.length) {
      await tx.insert(parties).values(
        body.opposingParties.map((p) => ({
          matterId: matter.id,
          role: 'opposing' as const,
          name: p.name,
          contact: p.contact ?? null,
        })),
      )
    }
    return matter
  })
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(result))
}

export async function getMatter(_request: IncomingMessage, response: ServerResponse, matterId: string) {
  const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1)
  if (!matter) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'matter not found' }))
    return
  }
  const matterParties = await db.select().from(parties).where(eq(parties.matterId, matterId))
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ matter, parties: matterParties }))
}

export async function logTimeEntry(request: IncomingMessage, response: ServerResponse, matterId: string) {
  const body = (await readJsonBody(request)) as {
    attorneyId?: string
    workedAt?: string
    minutes?: number
    narrative?: string
    billable?: boolean
  } | null
  if (!body?.attorneyId || !body.workedAt || !body.minutes || !body.narrative) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'attorneyId, workedAt, minutes, narrative required' }))
    return
  }
  if (!Number.isInteger(body.minutes) || body.minutes <= 0) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'minutes must be a positive integer' }))
    return
  }
  const [entry] = await db
    .insert(timeEntries)
    .values({
      matterId,
      attorneyId: body.attorneyId,
      workedAt: new Date(body.workedAt),
      minutes: body.minutes,
      narrative: body.narrative,
      billable: body.billable ?? true,
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(entry))
}

export async function listUnbilledTime(
  _request: IncomingMessage,
  response: ServerResponse,
  matterId: string,
) {
  const rows = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.matterId, matterId), eq(timeEntries.billable, true)))
  const unbilled = rows.filter((r) => r.invoiceId === null)
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ entries: unbilled }))
}
