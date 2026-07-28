import 'dotenv/config'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Sandbox, type SandboxInstance } from '@tangle-network/sandbox'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { stream } from 'hono/streaming'

const config = {
  apiKey: requiredEnv('TANGLE_SANDBOX_API_KEY'),
  baseUrl: process.env.TANGLE_SANDBOX_BASE_URL?.trim() || 'https://api.tangle.tools',
  sandboxId: requiredEnv('TANGLE_SANDBOX_ID'),
}

const client = new Sandbox({ apiKey: config.apiKey, baseUrl: config.baseUrl })
let sandboxPromise: Promise<SandboxInstance> | undefined

function getSandbox(): Promise<SandboxInstance> {
  sandboxPromise ??= client.get(config.sandboxId).then((sandbox) => {
    if (!sandbox) throw new Error(`Sandbox not found: ${config.sandboxId}`)
    return sandbox
  })
  return sandboxPromise.catch((cause: unknown) => {
    sandboxPromise = undefined
    throw cause
  })
}

const app = new Hono()

app.onError((error, context) => {
  if (error instanceof HTTPException) return error.getResponse()
  console.error('Sandbox API request failed', error)
  return context.json({ error: 'Sandbox API request failed' }, 500)
})

app.post('/api/prompt', async (context) => {
  const body = await jsonObject(context.req.raw)
  const prompt = boundedString(body.prompt, 'prompt', 100_000)
  const sessionId =
    body.sessionId === undefined ? undefined : boundedString(body.sessionId, 'sessionId', 512)
  const sandbox = await getSandbox()
  const controller = new AbortController()

  context.header('content-type', 'application/x-ndjson; charset=utf-8')
  context.header('cache-control', 'no-store')
  return stream(context, async (output) => {
    output.onAbort(() => controller.abort())
    try {
      for await (const event of sandbox.streamPrompt(prompt, {
        sessionId,
        signal: controller.signal,
      })) {
        await output.writeln(JSON.stringify(event))
      }
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Sandbox prompt stream failed', error)
      await output.writeln(
        JSON.stringify({ type: 'error', data: { message: 'Sandbox prompt stream failed' } }),
      )
    }
  })
})

const staticRoot = fileURLToPath(new URL('../dist/', import.meta.url))
app.use('*', serveStatic({ root: staticRoot }))
app.get('*', async (context) => context.html(await readFile(join(staticRoot, 'index.html'), 'utf8')))

const port = positiveInteger(process.env.API_PORT, 8787)
const hostname = process.env.HOST?.trim() || '127.0.0.1'
const server = serve({ fetch: app.fetch, port, hostname }, ({ port: activePort }) => {
  console.log(`Agent debugger listening on http://${hostname}:${activePort}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0))
  })
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`API_PORT must be an integer from 1 to 65535`)
  }
  return parsed
}

async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown
  try {
    value = await request.json()
  } catch {
    throw new HTTPException(400, { message: 'Request body must be valid JSON' })
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HTTPException(400, { message: 'Request body must be a JSON object' })
  }
  return value as Record<string, unknown>
}

function boundedString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HTTPException(400, { message: `${name} must be a non-empty string` })
  }
  if (value.length > maxLength) {
    throw new HTTPException(400, { message: `${name} exceeds ${maxLength} characters` })
  }
  return value
}
