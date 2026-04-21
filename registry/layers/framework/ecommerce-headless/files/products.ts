import type { IncomingMessage, ServerResponse } from 'node:http'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { products, variants } from '../db/schema.ts'

export async function listProducts(_request: IncomingMessage, response: ServerResponse) {
  const rows = await db.select().from(products).where(eq(products.status, 'active'))
  const variantRows = await db.select().from(variants)
  const byProduct = new Map<string, typeof variantRows>()
  for (const v of variantRows) {
    const arr = byProduct.get(v.productId) ?? []
    arr.push(v)
    byProduct.set(v.productId, arr)
  }
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(
    JSON.stringify({
      products: rows.map((p) => ({ ...p, variants: byProduct.get(p.id) ?? [] })),
    }),
  )
}

export async function getProduct(_request: IncomingMessage, response: ServerResponse, id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  if (!product) {
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'product not found' }))
    return
  }
  const rows = await db.select().from(variants).where(eq(variants.productId, id))
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ ...product, variants: rows }))
}
