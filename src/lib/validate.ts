import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

import type { ComposeSpec, ValidationCheck, ValidationResult, ComposeReport } from '../types.js'

import { composeStarter } from './compose.js'
import { createTempDir, fileExists, readJson, removeDir } from './fs.js'

interface ProcessResult {
  code: number
  stdout: string
  stderr: string
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function runCommand(
  command: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<ProcessResult> {
  const [bin, ...args] = command as [string, ...string[]]
  const child = spawn(bin, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return waitForExit(child)
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to reserve port'))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

async function waitForHttp(
  url: string,
  expected: string,
  timeoutMs: number,
): Promise<{ ok: boolean; body: string }> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      const body = await response.text()
      if (response.ok && body.includes(expected)) {
        return { ok: true, body }
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  return { ok: false, body: '' }
}

async function runHttpStartCheck(
  check: ValidationCheck,
  cwd: string,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const env: Record<string, string> = {}
  const port = await reservePort()
  env.PORT = String(port)
  if (check.runOnce) {
    env.RUN_ONCE = '1'
  }

  const command = check.command!
  const [bin, ...args] = command as [string, ...string[]]
  const child = spawn(bin, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })

  // Bail early if process exits before HTTP check completes
  let processExited = false
  child.on('close', () => {
    processExited = true
  })

  try {
    const url = `http://127.0.0.1:${port}${check.path}`
    const result = await waitForHttp(url, check.expect ?? 'ok', 5000)
    if (!result.ok) {
      if (processExited) {
        throw new Error(`Server exited before HTTP check completed for ${url}`)
      }
      throw new Error(`HTTP check failed for ${url}`)
    }
    return { ok: true, stdout, stderr }
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function runCommandSuccessCheck(check: ValidationCheck, cwd: string): Promise<ProcessResult> {
  const result = await runCommand(check.command!, cwd, check.env ?? {})
  if (result.code !== 0) {
    throw new Error(`Command failed: ${check.command!.join(' ')}`)
  }
  if (
    check.expect &&
    !result.stdout.includes(check.expect) &&
    !result.stderr.includes(check.expect)
  ) {
    throw new Error(`Command output missing expected text: ${check.expect}`)
  }
  return result
}

async function runPythonCompileCheck(check: ValidationCheck, cwd: string): Promise<ProcessResult> {
  const result = await runCommand(['python3', '-m', 'py_compile', check.path!], cwd)
  if (result.code !== 0) {
    throw new Error(result.stderr || `Python compile failed for ${check.path}`)
  }
  return result
}

async function runPromptFrontmatterCheck(
  check: ValidationCheck,
  cwd: string,
): Promise<{ frontmatterKeys: string[] }> {
  const filePath = path.join(cwd, check.path!)
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    throw new Error(
      `prompt-frontmatter-valid: cannot read ${check.path}: ${(error as Error).message}`,
      { cause: error },
    )
  }
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    throw new Error(
      `prompt-frontmatter-valid: ${check.path} does not start with YAML frontmatter delimiter '---'`,
    )
  }
  const closeIdx = raw.indexOf('\n---', 4)
  if (closeIdx === -1) {
    throw new Error(
      `prompt-frontmatter-valid: ${check.path} has no closing '---' for YAML frontmatter`,
    )
  }
  const block = raw.slice(4, closeIdx)
  const keys: string[] = []
  for (const line of block.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue
    const m = /^([a-zA-Z][a-zA-Z0-9_-]*):/.exec(line)
    if (m) keys.push(m[1])
  }
  if (keys.length === 0) {
    throw new Error(`prompt-frontmatter-valid: ${check.path} frontmatter has no keys`)
  }
  return { frontmatterKeys: keys }
}

const CRON_FIELD_RE =
  /^(\*|(?:\*\/[0-9]+)|(?:[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?(?:,[0-9]+(?:-[0-9]+)?(?:\/[0-9]+)?)*))$/

function parseCronExpression(expr: string): { fields: string[] } {
  const fields = expr.trim().split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(`cron must have exactly 5 fields, got ${fields.length}: "${expr}"`)
  }
  for (const f of fields) {
    if (!CRON_FIELD_RE.test(f)) {
      throw new Error(`cron field "${f}" not parseable in "${expr}"`)
    }
  }
  return { fields }
}

function maxFiresPerHour(expr: string): number {
  const { fields } = parseCronExpression(expr)
  const minute = fields[0]
  if (minute === '*') return 60
  if (minute.startsWith('*/')) {
    const step = Number.parseInt(minute.slice(2), 10)
    if (Number.isFinite(step) && step > 0) return Math.floor(60 / step)
  }
  const slots = new Set<number>()
  for (const part of minute.split(',')) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((n) => Number.parseInt(n, 10))
      if (Number.isFinite(a) && Number.isFinite(b)) for (let i = a; i <= b; i += 1) slots.add(i)
    } else {
      const n = Number.parseInt(part, 10)
      if (Number.isFinite(n)) slots.add(n)
    }
  }
  return slots.size || 1
}

async function runCronSyntaxCheck(
  check: ValidationCheck,
  cwd: string,
): Promise<{ crons: string[]; maxFiresPerHour: number }> {
  const filePath = path.join(cwd, check.path!)
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    throw new Error(`cron-syntax-valid: cannot read ${check.path}: ${(error as Error).message}`, {
      cause: error,
    })
  }
  const crons: string[] = []
  const cronArrayMatch = /crons\s*=\s*\[([^\]]*)\]/.exec(raw)
  if (cronArrayMatch && cronArrayMatch[1]) {
    for (const m of cronArrayMatch[1].matchAll(/"([^"]+)"/g)) {
      crons.push(m[1])
    }
  }
  if (crons.length === 0) {
    throw new Error(
      `cron-syntax-valid: no cron expressions found in ${check.path} ([triggers] crons = [...])`,
    )
  }
  let worst = 0
  for (const expr of crons) {
    const fph = maxFiresPerHour(expr)
    if (fph > worst) worst = fph
    if (fph > 60) {
      throw new Error(`cron-syntax-valid: "${expr}" fires ${fph}×/hour (>60 cap)`)
    }
  }
  return { crons, maxFiresPerHour: worst }
}

async function runAgentsMdCheck(
  check: ValidationCheck,
  cwd: string,
): Promise<{ frontmatterKeys: string[]; sections: string[] }> {
  const filePath = path.join(cwd, check.path!)
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    throw new Error(`agents-md-valid: cannot read ${check.path}: ${(error as Error).message}`, { cause: error })
  }
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    throw new Error(`agents-md-valid: ${check.path} missing YAML frontmatter`)
  }
  const closeIdx = raw.indexOf('\n---', 4)
  if (closeIdx === -1) throw new Error(`agents-md-valid: ${check.path} unterminated frontmatter`)
  const block = raw.slice(4, closeIdx)
  const required = ['name', 'role', 'domain', 'version']
  const keys: string[] = []
  for (const line of block.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue
    const m = /^([a-zA-Z][a-zA-Z0-9_-]*):/.exec(line)
    if (m) keys.push(m[1]!)
  }
  const missing = required.filter((k) => !keys.includes(k))
  if (missing.length) {
    throw new Error(`agents-md-valid: ${check.path} missing required keys: ${missing.join(', ')}`)
  }
  // Body sanity: should reference at least one of the secure-layer primitives
  // OR an explicit "no tools" disclaimer. This is the cheap signal that the
  // bundle author actually thought about what the agent does.
  const body = raw.slice(closeIdx + 4)
  const sections = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]!.trim())
  if (sections.length < 2) {
    throw new Error(`agents-md-valid: ${check.path} has fewer than 2 ## sections (need at least Role + How you work)`)
  }
  return { frontmatterKeys: keys, sections }
}

async function runMethodologyIndexCheck(
  check: ValidationCheck,
  cwd: string,
): Promise<{ entries: number; missing: string[] }> {
  // Same shape as template-index-valid; renamed for clarity in the new
  // pattern. Kept as a separate validator so bundles authored against
  // the old templates/ dir vs new methodology/ dir surface clearly.
  const indexPath = path.join(cwd, check.path!)
  let raw: string
  try {
    raw = await readFile(indexPath, 'utf8')
  } catch (error) {
    throw new Error(`methodology-index-valid: cannot read ${check.path}: ${(error as Error).message}`, { cause: error })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`methodology-index-valid: ${check.path} is not valid JSON: ${(error as Error).message}`, { cause: error })
  }
  const entries: { id?: string; path?: string; providedBy?: string }[] = Array.isArray(parsed)
    ? (parsed as { id?: string; path?: string; providedBy?: string }[])
    : Array.isArray((parsed as { entries?: unknown[] }).entries)
      ? (parsed as { entries: { id?: string; path?: string; providedBy?: string }[] }).entries
      : []
  if (entries.length === 0) throw new Error(`methodology-index-valid: ${check.path} has zero entries`)
  const indexDir = path.dirname(indexPath)
  const missing: string[] = []
  for (const entry of entries) {
    // Entries with `providedBy` come from a layer at compose time —
    // their files are not in the family's own files/ tree, so skip
    // path-existence check.
    if (entry.providedBy) continue
    if (!entry.path) {
      missing.push(`<entry without path: id=${entry.id ?? '?'}>`)
      continue
    }
    const target = path.resolve(indexDir, entry.path)
    if (!(await fileExists(target))) missing.push(entry.path)
  }
  if (missing.length > 0) {
    throw new Error(`methodology-index-valid: ${missing.length} dangling entries: ${missing.slice(0, 5).join(', ')}`)
  }
  return { entries: entries.length, missing }
}

async function runScheduleCheck(
  check: ValidationCheck,
  cwd: string,
): Promise<{ schedules: number; maxFiresPerHour: number }> {
  // Reads manifest.defaults.schedule[] from the family manifest at <cwd>/manifest.json
  // and validates each cron + capability id. Replaces cron-syntax-valid for
  // bundles using the markdown-only pattern (no wrangler.toml).
  const manifestPath = path.join(cwd, check.path ?? 'manifest.json')
  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf8')
  } catch (error) {
    throw new Error(`schedule-valid: cannot read ${manifestPath}: ${(error as Error).message}`, { cause: error })
  }
  let parsed: { defaults?: { schedule?: Array<{ id?: string; cron?: string; capability?: string }>; declaredCapabilities?: string[] } }
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`schedule-valid: ${manifestPath} not JSON: ${(error as Error).message}`, { cause: error })
  }
  const sched = parsed.defaults?.schedule ?? []
  if (sched.length === 0) {
    // No schedules declared = vacuously valid; the bundle has no cron triggers.
    return { schedules: 0, maxFiresPerHour: 0 }
  }
  const declaredCaps = new Set(parsed.defaults?.declaredCapabilities ?? [])
  let worst = 0
  const seenIds = new Set<string>()
  for (const trigger of sched) {
    if (!trigger.id) throw new Error(`schedule-valid: trigger missing 'id'`)
    if (seenIds.has(trigger.id)) throw new Error(`schedule-valid: duplicate schedule id '${trigger.id}'`)
    seenIds.add(trigger.id)
    if (!trigger.cron) throw new Error(`schedule-valid: trigger '${trigger.id}' missing cron`)
    if (!trigger.capability) throw new Error(`schedule-valid: trigger '${trigger.id}' missing capability`)
    if (declaredCaps.size > 0 && !declaredCaps.has(trigger.capability)) {
      throw new Error(`schedule-valid: trigger '${trigger.id}' capability '${trigger.capability}' not in declaredCapabilities`)
    }
    const fph = maxFiresPerHour(trigger.cron)
    if (fph > 60) throw new Error(`schedule-valid: trigger '${trigger.id}' fires ${fph}×/hour (>60 cap)`)
    if (fph > worst) worst = fph
  }
  return { schedules: sched.length, maxFiresPerHour: worst }
}

async function runTemplateIndexCheck(
  check: ValidationCheck,
  cwd: string,
): Promise<{ entries: number; missing: string[] }> {
  const indexPath = path.join(cwd, check.path!)
  let raw: string
  try {
    raw = await readFile(indexPath, 'utf8')
  } catch (error) {
    throw new Error(
      `template-index-valid: cannot read ${check.path}: ${(error as Error).message}`,
      { cause: error },
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `template-index-valid: ${check.path} is not valid JSON: ${(error as Error).message}`,
      { cause: error },
    )
  }
  const entries: { id?: string; path?: string }[] = Array.isArray(parsed)
    ? (parsed as { id?: string; path?: string }[])
    : Array.isArray((parsed as { entries?: unknown[] }).entries)
      ? (parsed as { entries: { id?: string; path?: string }[] }).entries
      : []
  if (entries.length === 0) {
    throw new Error(`template-index-valid: ${check.path} has zero entries`)
  }
  const indexDir = path.dirname(indexPath)
  const missing: string[] = []
  for (const entry of entries) {
    if (!entry.path) {
      missing.push(`<entry without path: id=${entry.id ?? '?'}>`)
      continue
    }
    const target = path.resolve(indexDir, entry.path)
    if (!(await fileExists(target))) missing.push(entry.path)
  }
  if (missing.length > 0) {
    throw new Error(
      `template-index-valid: ${missing.length} dangling entries: ${missing.slice(0, 5).join(', ')}`,
    )
  }
  return { entries: entries.length, missing }
}

async function runCheck(check: ValidationCheck, cwd: string): Promise<unknown> {
  switch (check.type) {
    case 'file-exists': {
      const exists = await fileExists(path.join(cwd, check.path!))
      if (!exists) {
        throw new Error(`Missing required file ${check.path}`)
      }
      return { type: check.type, path: check.path, ok: true }
    }

    case 'node-syntax': {
      const result = await runCommand(['node', '--check', check.path!], cwd)
      if (result.code !== 0) {
        throw new Error(result.stderr || `Node syntax failed for ${check.path}`)
      }
      return { type: check.type, path: check.path, ok: true }
    }

    case 'http-start': {
      await runHttpStartCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true }
    }

    case 'command-success': {
      await runCommandSuccessCheck(check, cwd)
      return { type: check.type, command: check.command, ok: true }
    }

    case 'python-compile': {
      await runPythonCompileCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true }
    }

    case 'prompt-frontmatter-valid': {
      const result = await runPromptFrontmatterCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true, ...result }
    }

    case 'cron-syntax-valid': {
      const result = await runCronSyntaxCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true, ...result }
    }

    case 'template-index-valid': {
      const result = await runTemplateIndexCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true, ...result }
    }

    case 'agents-md-valid': {
      const result = await runAgentsMdCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true, ...result }
    }

    case 'methodology-index-valid': {
      const result = await runMethodologyIndexCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true, ...result }
    }

    case 'schedule-valid': {
      const result = await runScheduleCheck(check, cwd)
      return { type: check.type, path: check.path, ok: true, ...result }
    }

    default:
      throw new Error(`Unsupported validation check ${check.type}`)
  }
}

export async function validateStarter({
  spec,
  outDir = null,
}: {
  spec: ComposeSpec
  outDir?: string | null
}): Promise<ValidationResult> {
  const composedDir = outDir ?? (await createTempDir('starter-foundry-validate'))
  const cleanup = !outDir
  const composeResult = await composeStarter({ spec, outDir: composedDir })
  const composeReport = await readJson<ComposeReport>(composeResult.composeReportPath)
  const results: ValidationResult['checks'] = []

  try {
    for (const check of composeReport.validationChecks) {
      const startedAt = performance.now()
      try {
        const result = await runCheck(check, composedDir)
        results.push({
          ok: true,
          check,
          durationMs: Math.round(performance.now() - startedAt),
          result,
        })
      } catch (error) {
        results.push({
          ok: false,
          check,
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } finally {
    if (cleanup) {
      await removeDir(composedDir)
    }
  }

  return {
    ok: results.every((result) => result.ok),
    outDir: composedDir,
    checks: results,
  }
}

export async function validateComposedDir({
  composedDir,
  checks,
}: {
  composedDir: string
  checks: ValidationCheck[]
}): Promise<ValidationResult> {
  const results: ValidationResult['checks'] = []
  for (const check of checks) {
    const startedAt = performance.now()
    try {
      const result = await runCheck(check, composedDir)
      results.push({
        ok: true,
        check,
        durationMs: Math.round(performance.now() - startedAt),
        result,
      })
    } catch (error) {
      results.push({
        ok: false,
        check,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return {
    ok: results.every((r) => r.ok),
    outDir: composedDir,
    checks: results,
  }
}
