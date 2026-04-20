// Provider-neutral banking client. Pick one provider at config time; the
// method surface is the same. Each concrete implementation is a thin wrapper
// over the provider's REST API — extend freely.

import { z } from 'zod'
import config from '../banking-config.json'

type Provider = 'unit' | 'column' | 'mercury'
const provider = config.provider as Provider
const providerConfig = (config.providers as Record<Provider, { baseUrl: string; apiKeyEnv: string }>)[provider]

const Account = z.object({
  id: z.string(),
  name: z.string(),
  balanceCents: z.number(),
  routingNumber: z.string().optional(),
  accountNumber: z.string().optional(),
})

const Transfer = z.object({
  id: z.string(),
  amountCents: z.number(),
  status: z.enum(['pending', 'sent', 'rejected', 'returned']),
  createdAt: z.string(),
})

function apiKey(): string {
  const key = process.env[providerConfig.apiKeyEnv]
  if (!key) throw new Error(`Banking provider ${provider}: ${providerConfig.apiKeyEnv} is not set`)
  return key
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${providerConfig.baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey()}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`${provider} API ${init?.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

/** List accounts owned by the authenticated application. */
export async function listAccounts(): Promise<z.infer<typeof Account>[]> {
  switch (provider) {
    case 'unit': {
      const body = (await request('/accounts')) as { data: Array<{ id: string; attributes: Record<string, unknown> }> }
      return body.data.map((a) => Account.parse({
        id: a.id,
        name: String(a.attributes['name'] ?? ''),
        balanceCents: Number(a.attributes['balance'] ?? 0),
        routingNumber: a.attributes['routingNumber'] as string | undefined,
        accountNumber: a.attributes['accountNumber'] as string | undefined,
      }))
    }
    case 'column': {
      const body = (await request('/bank-accounts')) as { bank_accounts: Array<Record<string, unknown>> }
      return body.bank_accounts.map((a) => Account.parse({
        id: String(a['id']),
        name: String(a['description'] ?? ''),
        balanceCents: Number(a['available_amount'] ?? 0),
        routingNumber: a['routing_number'] as string | undefined,
        accountNumber: a['account_number'] as string | undefined,
      }))
    }
    case 'mercury': {
      const body = (await request('/accounts')) as { accounts: Array<Record<string, unknown>> }
      return body.accounts.map((a) => Account.parse({
        id: String(a['id']),
        name: String(a['name'] ?? ''),
        balanceCents: Math.round(Number(a['availableBalance'] ?? 0) * 100),
        routingNumber: a['routingNumber'] as string | undefined,
        accountNumber: a['accountNumber'] as string | undefined,
      }))
    }
  }
}

/** Initiate an ACH transfer out of an account. Amount in cents. */
export async function sendACH(params: {
  fromAccountId: string
  amountCents: number
  recipientRoutingNumber: string
  recipientAccountNumber: string
  recipientName: string
  memo?: string
}): Promise<z.infer<typeof Transfer>> {
  switch (provider) {
    case 'unit':
    case 'column': {
      // Simplified — real payloads differ per provider; use the docs for full schemas.
      const body = (await request(`/ach-transfers`, {
        method: 'POST',
        body: JSON.stringify({ ...params }),
      })) as Record<string, unknown>
      return Transfer.parse({
        id: String(body['id'] ?? ''),
        amountCents: params.amountCents,
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
    }
    case 'mercury': {
      const body = (await request(`/account/${params.fromAccountId}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          amount: params.amountCents / 100,
          recipientId: `${params.recipientRoutingNumber}-${params.recipientAccountNumber}`,
          note: params.memo,
        }),
      })) as Record<string, unknown>
      return Transfer.parse({
        id: String(body['id'] ?? ''),
        amountCents: params.amountCents,
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
    }
  }
}
