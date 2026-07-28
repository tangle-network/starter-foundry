import 'dotenv/config'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Sandbox, type SandboxInstance } from '@tangle-network/sandbox'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

const config = {
  apiKey: requiredEnv('TANGLE_SANDBOX_API_KEY'),
  baseUrl: process.env.TANGLE_SANDBOX_BASE_URL?.trim() || '{{sandboxApiUrl}}',
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

app.get('/api/config', (context) => context.json({ sandboxId: config.sandboxId }))

app.get('/api/files', async (context) => {
  const path = boundedString(context.req.query('path') ?? '/', 'path', 4096)
  const sandbox = await getSandbox()
  return context.json(await sandbox.fs.tree(path))
})

app.get('/api/file', async (context) => {
  const path = boundedString(context.req.query('path'), 'path', 4096)
  const sandbox = await getSandbox()
  return context.json({ content: await sandbox.fs.read(path) })
})

app.put('/api/file', async (context) => {
  const body = await jsonObject(context.req.raw)
  const path = boundedString(body.path, 'path', 4096)
  const content = boundedString(body.content, 'content', 5_000_000, true)
  const sandbox = await getSandbox()
  await sandbox.fs.write(path, content)
  return context.json({ ok: true })
})

app.post('/api/exec', async (context) => {
  const body = await jsonObject(context.req.raw)
  const command = boundedString(body.command, 'command', 16_384)
  const sandbox = await getSandbox()
  const result = await sandbox.exec(command)
  return context.json({ stdout: result.stdout, stderr: result.stderr })
})

const staticRoot = fileURLToPath(new URL('../dist/', import.meta.url))
app.use('*', serveStatic({ root: staticRoot }))
app.get('*', async (context) => context.html(await readFile(join(staticRoot, 'index.html'), 'utf8')))

const port = positiveInteger(process.env.API_PORT, 8787)
const hostname = process.env.HOST?.trim() || '127.0.0.1'
const server = serve({ fetch: app.fetch, port, hostname }, ({ port: activePort }) => {
  console.log(`Sandbox app listening on http://${hostname}:${activePort}`)
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

function boundedString(
  value: unknown,
  name: string,
  maxLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new HTTPException(400, { message: `${name} must be a non-empty string` })
  }
  if (value.length > maxLength) {
    throw new HTTPException(400, { message: `${name} exceeds ${maxLength} characters` })
  }
  return value
}
