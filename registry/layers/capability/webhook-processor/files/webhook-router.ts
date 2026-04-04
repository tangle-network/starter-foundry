import { verifySignature } from './webhook-handler'

interface WebhookEvent {
  id: string
  provider: string
  type: string
  payload: unknown
  receivedAt: string
}

interface ProviderConfig {
  secret: string
  handler: (event: WebhookEvent) => Promise<void>
}

interface WebhookRequest {
  headers: Record<string, string | undefined>
  body: string
}

interface WebhookResponse {
  status: number
  body: Record<string, unknown>
}

const SIGNATURE_HEADERS: Record<string, string> = {
  stripe: 'stripe-signature',
  github: 'x-hub-signature-256',
}

const EVENT_TYPE_HEADERS: Record<string, string> = {
  stripe: 'x-stripe-event',
  github: 'x-github-event',
}

function extractEventType(provider: string, headers: Record<string, string | undefined>, parsed: any): string {
  const header = EVENT_TYPE_HEADERS[provider]
  if (header && headers[header]) return headers[header]!
  return parsed?.type ?? parsed?.action ?? 'unknown'
}

export function createWebhookRouter(config: {
  providers: Record<string, ProviderConfig>
}) {
  return async (req: WebhookRequest): Promise<WebhookResponse> => {
    for (const [provider, providerConfig] of Object.entries(config.providers)) {
      const sigHeader = SIGNATURE_HEADERS[provider] ?? `x-${provider}-signature`
      const signature = req.headers[sigHeader]
      if (!signature) continue

      const valid = verifySignature(provider, req.body, signature, providerConfig.secret)
      if (!valid) {
        return { status: 400, body: { error: `Invalid ${provider} signature` } }
      }

      const parsed = JSON.parse(req.body)
      const event: WebhookEvent = {
        id: parsed.id ?? crypto.randomUUID(),
        provider,
        type: extractEventType(provider, req.headers, parsed),
        payload: parsed,
        receivedAt: new Date().toISOString(),
      }

      try {
        await providerConfig.handler(event)
        return { status: 200, body: { received: true, id: event.id } }
      } catch (err) {
        return { status: 500, body: { error: 'Handler failed', id: event.id } }
      }
    }

    return { status: 400, body: { error: 'No matching provider for request' } }
  }
}

export type { WebhookEvent, ProviderConfig, WebhookRequest, WebhookResponse }
