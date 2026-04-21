import type { FastifyPluginAsync } from 'fastify'
import { LedgerError, postTransaction } from '../ledger/post.js'
import { accountBalance, accountEntries } from '../ledger/query.js'

interface PostTransactionBody {
  idempotencyKey?: string
  externalRef?: string
  memo?: string
  entries?: Array<{
    accountId: string
    direction: 'debit' | 'credit'
    amount: string | number
    currency: string
  }>
}

export const transactionsPlugin: FastifyPluginAsync = async (app) => {
  app.post<{ Body: PostTransactionBody }>('/api/transactions', async (req, reply) => {
    const body = req.body
    if (!body?.entries || body.entries.length === 0) {
      return reply.code(422).send({ error: 'entries[] required' })
    }
    try {
      const result = await postTransaction({
        idempotencyKey: body.idempotencyKey,
        externalRef: body.externalRef,
        memo: body.memo,
        entries: body.entries,
      })
      return reply.code(result.idempotent ? 200 : 201).send(result)
    } catch (err) {
      if (err instanceof LedgerError) {
        return reply.code(422).send({ error: err.message, code: err.code })
      }
      throw err
    }
  })

  app.get<{ Params: { id: string }; Querystring: { asOf?: string } }>(
    '/api/accounts/:id/balance',
    async (req, reply) => {
      const asOfRaw = req.query.asOf
      const asOf = asOfRaw ? new Date(asOfRaw) : new Date()
      if (Number.isNaN(asOf.getTime())) {
        return reply.code(400).send({ error: 'invalid asOf timestamp' })
      }
      return accountBalance(req.params.id, asOf)
    },
  )

  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/accounts/:id/entries',
    async (req, reply) => {
      const limit = Math.min(parseInt(req.query.limit ?? '100', 10) || 100, 500)
      const rows = await accountEntries(req.params.id, { limit })
      return { entries: rows }
    },
  )
}
