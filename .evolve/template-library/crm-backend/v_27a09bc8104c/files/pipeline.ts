// Deal pipeline operations. Moving a deal writes a DealStageHistory row so
// velocity reports (avg days per stage) are possible. Transitioning into a
// closedWon / closedLost stage also flips the Deal.status + timestamps.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { dealStageHistory, deals, stages, activities } from '../db/schema.js'

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

export async function createDeal(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as {
    title?: string
    amountCents?: number
    currency?: string
    stageId?: string
    contactId?: string
    companyId?: string
    ownerUserId?: string
    expectedCloseAt?: string
  } | null
  if (!body?.title || !body.stageId) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'title and stageId required' }))
    return
  }
  if (body.amountCents !== undefined && !Number.isInteger(body.amountCents)) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'amountCents must be an integer' }))
    return
  }
  const [row] = await db
    .insert(deals)
    .values({
      title: body.title,
      amountCents: body.amountCents ?? 0,
      currency: body.currency ?? 'USD',
      stageId: body.stageId,
      contactId: body.contactId ?? null,
      companyId: body.companyId ?? null,
      ownerUserId: body.ownerUserId ?? null,
      expectedCloseAt: body.expectedCloseAt ? new Date(body.expectedCloseAt) : null,
    })
    .returning()
  if (!row) throw new Error('Record not found')
  // Record initial stage in history
  await db.insert(dealStageHistory).values({
    dealId: row.id,
    fromStageId: null,
    toStageId: row.stageId,
    movedByUserId: body.ownerUserId ?? null,
  })
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function moveDealStage(
  request: IncomingMessage,
  response: ServerResponse,
  dealId: string,
) {
  const body = (await readJsonBody(request)) as {
    toStageId?: string
    movedByUserId?: string
    notes?: string
    lostReason?: string
  } | null
  if (!body?.toStageId) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'toStageId required' }))
    return
  }

  const result = await db.transaction(async (tx) => {
    const [deal] = await tx.select().from(deals).where(eq(deals.id, dealId)).limit(1)
    if (!deal) throw new Error('NOT_FOUND')
    if (deal.status !== 'open') {
      throw new Error('CLOSED_DEAL_IMMUTABLE')
    }
    const [toStage] = await tx.select().from(stages).where(eq(stages.id, body.toStageId!)).limit(1)
    if (!toStage) throw new Error('STAGE_NOT_FOUND')

    const now = new Date()
    const update: Partial<typeof deals.$inferInsert> = {
      stageId: toStage.id,
      updatedAt: now,
    }
    if (toStage.isClosedWon) {
      update.status = 'won'
      update.wonAt = now
    } else if (toStage.isClosedLost) {
      update.status = 'lost'
      update.lostAt = now
      if (body.lostReason) update.lostReason = body.lostReason
    }

    const [updated] = await tx.update(deals).set(update).where(eq(deals.id, dealId)).returning()
    await tx.insert(dealStageHistory).values({
      dealId,
      fromStageId: deal.stageId,
      toStageId: toStage.id,
      movedByUserId: body.movedByUserId ?? null,
      notes: body.notes ?? null,
    })
    return updated
  }).catch((err) => err as Error)

  if (result instanceof Error) {
    const map: Record<string, number> = {
      NOT_FOUND: 404,
      STAGE_NOT_FOUND: 422,
      CLOSED_DEAL_IMMUTABLE: 409,
    }
    response.writeHead(map[result.message] ?? 500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: result.message }))
    return
  }
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(result))
}

export async function logActivity(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as {
    type?: 'call' | 'email' | 'meeting' | 'note' | 'task'
    occurredAt?: string
    summary?: string
    body?: string
    contactId?: string
    companyId?: string
    dealId?: string
    ownerUserId?: string
  } | null
  if (!body?.type || !body.summary) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'type and summary required' }))
    return
  }
  const [row] = await db
    .insert(activities)
    .values({
      type: body.type,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
      summary: body.summary,
      body: body.body ?? null,
      contactId: body.contactId ?? null,
      companyId: body.companyId ?? null,
      dealId: body.dealId ?? null,
      ownerUserId: body.ownerUserId ?? null,
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}
