// Cart API. Line-item unit_price is snapshot at add-to-cart time so catalog
// edits don't retroactively alter a customer's open cart.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { carts, lineItems, variants } from '../db/schema.ts'

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : null
}

export async function createCart(request: IncomingMessage, response: ServerResponse) {
  const body = (await readJsonBody(request)) as {
    customerId?: string
    currency?: string
  } | null
  const [row] = await db
    .insert(carts)
    .values({
      customerId: body?.customerId ?? null,
      currency: body?.currency ?? 'USD',
    })
    .returning()
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(row))
}

export async function getCart(_request: IncomingMessage, response: ServerResponse, cartId: string) {
  const [cart] = await db.select().from(carts).where(eq(carts.id, cartId)).limit(1)
  if (!cart) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'cart not found' }))
    return
  }
  const items = await db.select().from(lineItems).where(eq(lineItems.cartId, cartId))
  const subtotal = items.reduce((acc, it) => acc + it.unitPriceCents * it.qty, 0)
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ ...cart, items, subtotalCents: subtotal }))
}

export async function addLineItem(
  request: IncomingMessage,
  response: ServerResponse,
  cartId: string,
) {
  const body = (await readJsonBody(request)) as {
    variantId?: string
    qty?: number
  } | null
  if (!body?.variantId || !body.qty || body.qty <= 0) {
    response.writeHead(422, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'variantId and positive qty required' }))
    return
  }
  const result = await db.transaction(async (tx) => {
    const [cart] = await tx.select().from(carts).where(eq(carts.id, cartId)).limit(1)
    if (!cart) throw new Error('CART_NOT_FOUND')
    if (cart.status !== 'active') throw new Error('CART_NOT_ACTIVE')
    const [variant] = await tx.select().from(variants).where(eq(variants.id, body.variantId!)).limit(1)
    if (!variant) throw new Error('VARIANT_NOT_FOUND')
    if (variant.currency !== cart.currency) throw new Error('CURRENCY_MISMATCH')

    // Upsert-by-variant: if the variant is already in the cart, increment qty.
    const [existing] = await tx
      .select()
      .from(lineItems)
      .where(and(eq(lineItems.cartId, cartId), eq(lineItems.variantId, variant.id)))
      .limit(1)
    if (existing) {
      const [updated] = await tx
        .update(lineItems)
        .set({ qty: existing.qty + body.qty! })
        .where(eq(lineItems.id, existing.id))
        .returning()
      return updated
    }
    const [inserted] = await tx
      .insert(lineItems)
      .values({
        cartId,
        variantId: variant.id,
        qty: body.qty!,
        // Snapshot the current price. Catalog edits WILL NOT affect this cart.
        unitPriceCents: variant.priceCents,
        currency: variant.currency,
      })
      .returning()
    await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId))
    return inserted
  }).catch((e) => e as Error)

  if (result instanceof Error) {
    const map: Record<string, number> = {
      CART_NOT_FOUND: 404,
      VARIANT_NOT_FOUND: 404,
      CART_NOT_ACTIVE: 409,
      CURRENCY_MISMATCH: 422,
    }
    response.writeHead(map[result.message] ?? 500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: result.message }))
    return
  }
  response.writeHead(201, { 'content-type': 'application/json' })
  response.end(JSON.stringify(result))
}

export async function removeLineItem(
  _request: IncomingMessage,
  response: ServerResponse,
  cartId: string,
  lineItemId: string,
) {
  await db.delete(lineItems).where(and(eq(lineItems.cartId, cartId), eq(lineItems.id, lineItemId)))
  response.writeHead(204)
  response.end()
}
