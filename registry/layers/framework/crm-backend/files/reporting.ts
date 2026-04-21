// CRM reporting endpoints. Aggregates are computed at query time from the
// deals + activities tables. For production you'll want materialized views
// or a separate analytics store — this is the seam.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { deals, stages } from '../db/schema.js'

export async function wonAmountByMonth(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '', 'http://localhost')
  const year = Number.parseInt(url.searchParams.get('year') ?? String(new Date().getUTCFullYear()), 10)
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    response.writeHead(400, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'invalid year' }))
    return
  }
  const rows = await db.execute(sql`
    SELECT
      date_trunc('month', ${deals.wonAt})::date AS month,
      ${deals.currency} AS currency,
      COUNT(*)::int AS deal_count,
      SUM(${deals.amountCents})::bigint AS won_amount_cents
    FROM ${deals}
    WHERE ${deals.wonAt} IS NOT NULL
      AND EXTRACT(YEAR FROM ${deals.wonAt}) = ${year}
    GROUP BY month, ${deals.currency}
    ORDER BY month ASC, ${deals.currency} ASC
  `)
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ year, rows }))
}

export async function pipelineValue(_request: IncomingMessage, response: ServerResponse) {
  // Open deals per stage, weighted by stage probability.
  const rows = await db.execute(sql`
    SELECT
      ${stages.id} AS stage_id,
      ${stages.name} AS stage_name,
      ${stages.order} AS stage_order,
      ${stages.probability} AS probability,
      ${deals.currency} AS currency,
      COUNT(${deals.id})::int AS open_count,
      COALESCE(SUM(${deals.amountCents}), 0)::bigint AS open_amount_cents,
      COALESCE(SUM(${deals.amountCents} * ${stages.probability})::bigint, 0) AS weighted_amount_cents
    FROM ${stages}
    LEFT JOIN ${deals}
      ON ${deals.stageId} = ${stages.id}
      AND ${deals.status} = 'open'
    WHERE ${stages.isClosedWon} = false
      AND ${stages.isClosedLost} = false
    GROUP BY ${stages.id}, ${stages.name}, ${stages.order}, ${stages.probability}, ${deals.currency}
    ORDER BY ${stages.order} ASC
  `)
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ rows }))
}

export async function winRate(_request: IncomingMessage, response: ServerResponse) {
  // Returns counts per status so the caller can compute won/(won+lost) as needed.
  const rows = await db
    .select({
      status: deals.status,
      count: sql<number>`count(*)::int`,
    })
    .from(deals)
    .groupBy(deals.status)
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ rows }))
}
