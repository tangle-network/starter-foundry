import Fastify from 'fastify'
import { transactionsPlugin } from './api/transactions.js'

// ── env ──────────────────────────────────────────────────────────────────────
const PORT: number = parseInt(process.env['PORT'] ?? '3000', 10)
const HOST: string = process.env['HOST'] ?? '0.0.0.0'
const DATABASE_URL: string = process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/ledger'
const BASE_CURRENCY: string = process.env['BASE_CURRENCY'] ?? 'USD'
// ─────────────────────────────────────────────────────────────────────────────

const server = Fastify({ logger: true })

server.get('/health', async () => ({
  status: 'ok',
  service: 'starter-foundry-ledger',
  baseCurrency: BASE_CURRENCY,
}))

await server.register(transactionsPlugin)

server.log.info(
  { port: PORT, host: HOST, db: DATABASE_URL.replace(/:[^:@]+@/, ':***@'), currency: BASE_CURRENCY },
  'starter-foundry-ledger starting',
)

await server.listen({ port: PORT, host: HOST })
