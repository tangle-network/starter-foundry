import type { IncomingMessage, ServerResponse } from 'node:http'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { companies, contacts } from '../db/schema.js'

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

export async function createContact(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    title?: string
    companyId?: string
    ownerUserId?: string
  } | null
  if (!body || (!body.email && !body.firstName && !body.lastName)) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'at least one of email / firstName / lastName required' }))
    return
  }
  const [row] = await db
    .insert(contacts)
    .values({
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      title: body.title ?? null,
      companyId: body.companyId ?? null,
      ownerUserId: body.ownerUserId ?? null,
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function getContact(_request: IncomingMessage, response: ServerResponse, id: string) {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1)
  if (!row) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'contact not found' }))
    return
  }
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function createCompany(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as {
    name?: string
    domain?: string
    industry?: string
    sizeRange?: string
    website?: string
    ownerUserId?: string
  } | null
  if (!body?.name) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'name required' }))
    return
  }
  const [row] = await db
    .insert(companies)
    .values({
      name: body.name,
      domain: body.domain ?? null,
      industry: body.industry ?? null,
      sizeRange: body.sizeRange ?? null,
      website: body.website ?? null,
      ownerUserId: body.ownerUserId ?? null,
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function getCompany(_request: IncomingMessage, response: ServerResponse, id: string) {
  const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1)
  if (!row) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'company not found' }))
    return
  }
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}
