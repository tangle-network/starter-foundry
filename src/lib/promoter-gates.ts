// Gen 9 dogfood gates. Three promoter-side checks that run AFTER the
// Build gate (tsc --noEmit / cargo check / etc. pass) and BEFORE the
// LLM-driven Fidelity gate. They catch the "ships silently broken" class
// that compile-gates + manifest schema can't see:
//
//   1. declared-dep-used  — every packageDeps entry is actually imported
//      somewhere in the composed output. Motivating bug: PR #55 shipped
//      capability:agent-eval declaring `@tangle-network/agent-eval` but
//      no source file imported it. Compile passed, fidelity passed, the
//      dep was inert.
//
//   2. scaffold-runs       — if the composed scaffold has a `start`
//      script, actually boot it and hit GET /health. Proves the thing
//      doesn't just compile — it can start.
//
//   3. eval-scores         — if the scaffold composed capability:agent-eval,
//      run its OWN eval harness against the still-booted agent and assert
//      the aggregate score clears the manifest threshold.
//
// Each gate returns `{ gate, status, ...detail }`. `status` is one of:
//   - 'pass'     — gate ran, passed
//   - 'fail'     — gate ran, failed (promoter MUST short-circuit)
//   - 'skipped'  — gate intentionally inapplicable to this scaffold;
//                  promoter continues. Skip reasons are enumerated per-gate
//                  so a skipped gate on a scaffold that SHOULD have run it
//                  (e.g. agent-eval composed but scaffold-runs skipped
//                  for no-start-script) is still visible in the scorecard.

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { spawn } from 'node:child_process'

// ──────────────────────────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────────────────────────

export type GateStatus = 'pass' | 'fail' | 'skipped'

export interface BaseGateResult {
  gate: string
  status: GateStatus
  message?: string
  reason?: string
}

export interface DeclaredDepUsedResult extends BaseGateResult {
  gate: 'declared-dep-used'
  /** All packageDeps keys that had no matching import/require in any emitted file. Populated on fail. */
  unusedDeps?: string[]
  /** Files searched for import/require (relative paths). Populated always so the scorecard shows search scope. */
  filesSearched?: string[]
}

export interface ScaffoldRunsResult extends BaseGateResult {
  gate: 'scaffold-runs'
  reason?: string
  stderr?: string
  /** Port the scaffold was booted on (pass case only). */
  port?: number
  /** Handle to the still-running process so gate 3 can reuse it. Only set on pass. */
  process?: { pid: number; kill: () => void }
}

export interface EvalScoresResult extends BaseGateResult {
  gate: 'eval-scores'
  aggregate?: number
  threshold?: number
  failing?: string[]
  reason?: string
}

// ──────────────────────────────────────────────────────────────────
// Gate 1 — declared-dep-used
// ──────────────────────────────────────────────────────────────────

/**
 * Walk every emitted file in the composed output. For each declared
 * package (dependencies + devDependencies + peerDependencies on the
 * capability/family manifest), assert at least one file contains
 * `import ... from '<pkg>'` or `require('<pkg>')`.
 *
 * Handles scoped packages (`@scope/name`) — the regex is built from
 * escaped package names, so the `@` and `/` don't trip the pattern.
 *
 * Search scope: the ENTIRE composed output, not just the capability's
 * own files/. Rationale: the motivating case is a capability declaring
 * a dep whose consumer sits one layer up (family framework layer uses
 * it; the capability-under-audit just declares it because it composes
 * alongside). Limiting to the capability's own files would false-fail
 * those valid cases. A broken declaration is still caught — the scope
 * widening preserves correctness while accepting a superset.
 */
export function checkDeclaredDepUsed(args: {
  manifest: Record<string, unknown>
  composedDir: string
}): DeclaredDepUsedResult {
  const { manifest, composedDir } = args
  const deps = manifestPackageDeps(manifest)
  if (deps.length === 0) {
    return { gate: 'declared-dep-used', status: 'skipped', reason: 'no-package-deps', filesSearched: [] }
  }

  const files = listScannableFiles(composedDir)
  const unused: string[] = []
  for (const pkg of deps) {
    if (!anyFileImports(files, composedDir, pkg)) {
      unused.push(pkg)
    }
  }

  const filesSearched = files.map((f) => relative(composedDir, f))
  if (unused.length > 0) {
    return {
      gate: 'declared-dep-used',
      status: 'fail',
      unusedDeps: unused,
      filesSearched,
      message: `packageDeps declared but unused in composed output: ${unused.join(', ')}`,
    }
  }
  return { gate: 'declared-dep-used', status: 'pass', filesSearched }
}

function manifestPackageDeps(manifest: Record<string, unknown>): string[] {
  const pkg = manifest.packageDeps as
    | { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> }
    | undefined
  if (!pkg) return []
  const names = new Set<string>()
  for (const group of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
    if (!group) continue
    for (const name of Object.keys(group)) names.add(name)
  }
  return [...names]
}

// Extensions we'll scan for import/require. Skip binary + asset + lockfile
// — they're never the site of a JS/TS import statement.
const SCANNABLE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', // package.json references, JSON-imports via bundlers
  '.md',   // README examples
  '.py', '.rs', '.go', '.sol', '.move',
  '.yml', '.yaml',
])

function listScannableFiles(rootDir: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'target') continue
      const full = join(dir, entry)
      let s
      try { s = statSync(full) } catch { continue }
      if (s.isDirectory()) { walk(full); continue }
      const ext = extname(entry).toLowerCase()
      if (SCANNABLE_EXTS.has(ext) || entry === 'package.json') out.push(full)
    }
  }
  walk(rootDir)
  return out
}

function anyFileImports(files: string[], root: string, pkg: string): boolean {
  // For scoped packages like `@tangle-network/agent-eval`, escape both
  // `@` and `/`. The general import regex accepts both static and
  // dynamic imports, bare-specifier re-exports, and CJS require().
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`from\\s+['"]${escaped}(?:/[^'"\\s]*)?['"]`),
    new RegExp(`require\\(\\s*['"]${escaped}(?:/[^'"\\s]*)?['"]\\s*\\)`),
    new RegExp(`import\\s*\\(\\s*['"]${escaped}(?:/[^'"\\s]*)?['"]\\s*\\)`),
    // `import '<pkg>'` side-effect import (no `from`) — covers e.g. polyfills.
    new RegExp(`import\\s+['"]${escaped}(?:/[^'"\\s]*)?['"]`),
    // package.json references (dependencies/peerDeps declared by consumer
    // scaffolds are legitimate usage of a dep even without an import).
    new RegExp(`"${escaped}"\\s*:`),
  ]
  for (const abs of files) {
    let text: string
    try { text = readFileSync(abs, 'utf8') } catch { continue }
    // Skip the root-level package.json — it's where the dep is DECLARED,
    // not "used". A scaffold's own package.json listing the dep cannot
    // count as proof-of-use (otherwise this gate would always pass). We
    // still include nested package.json (e.g. workspace sub-projects).
    const rel = relative(root, abs)
    if (rel === 'package.json') continue
    for (const pattern of patterns) {
      if (pattern.test(text)) return true
    }
  }
  return false
}

// ──────────────────────────────────────────────────────────────────
// Gate 2 — scaffold-runs
// ──────────────────────────────────────────────────────────────────

export interface ScaffoldRunsOptions {
  /** Override port — defaults to manifest `defaults.port` then 3100. */
  port?: number
  /** Max time to wait for /health 2xx. Defaults to 20s. */
  readyTimeoutMs?: number
  /** Skip cleanup of the process — gate 3 will reuse it. */
  keepProcess?: boolean
}

/**
 * Boot the composed scaffold's `start` script, wait for /health 2xx on
 * PORT, then either SIGTERM or return a handle for gate 3 to reuse.
 *
 * Language dispatch:
 *   - TS/JS: checks package.json for a `start` script. Runs
 *     `pnpm start` with PORT=<port>, waits on /health.
 *   - Other: returns skipped with `reason: 'unsupported-lang'`. See
 *     TODO below — second iteration will add language branches for
 *     rust/python/go.
 *
 * Skip contract: we DO NOT silently pass. When there's no `start`
 * script, we emit `status: 'skipped'` with `reason: 'no-start-script'`.
 * The scorecard can detect "scaffold has an agent surface but didn't
 * declare a boot contract" from a higher level.
 */
export async function checkScaffoldRuns(args: {
  composedDir: string
  manifest: Record<string, unknown>
  options?: ScaffoldRunsOptions
}): Promise<ScaffoldRunsResult> {
  const { composedDir, manifest, options = {} } = args
  const port = resolveScaffoldPort(manifest, options.port)
  const readyTimeoutMs = options.readyTimeoutMs ?? 20_000

  const language = (manifest.taxonomy as Record<string, unknown> | undefined)?.language as string | undefined
  const tsOrJs = language === 'typescript' || language === 'javascript' || language === undefined
  // TODO: add rust-runs / python-runs / go-runs branches — first iteration
  // targets JS/TS because that's where capability:agent-eval lives.
  if (!tsOrJs) {
    return {
      gate: 'scaffold-runs',
      status: 'skipped',
      reason: 'unsupported-lang',
      message: `language '${language ?? 'unknown'}' not yet supported; TODO: add <lang>-runs branch`,
    }
  }

  const pkgPath = join(composedDir, 'package.json')
  if (!existsSync(pkgPath)) {
    return { gate: 'scaffold-runs', status: 'skipped', reason: 'no-package-json' }
  }
  let pkg: { scripts?: Record<string, string> }
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return { gate: 'scaffold-runs', status: 'skipped', reason: 'unreadable-package-json' }
  }
  const startCmd = pkg.scripts?.start
  if (!startCmd) {
    return { gate: 'scaffold-runs', status: 'skipped', reason: 'no-start-script' }
  }

  // Spawn pnpm start. We use node-native spawn rather than
  // SubprocessSandboxDriver here because we need a long-lived handle
  // (the driver's exec awaits exit, which never happens for a server).
  const child = spawn('pnpm', ['start'], {
    cwd: composedDir,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderrBuf = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => { stderrBuf = (stderrBuf + chunk).slice(-4000) })
  child.stdout.setEncoding('utf8')
  // Keep stdout drained so the child's pipe buffer doesn't block it.
  child.stdout.on('data', () => { /* drain */ })

  // If the child exits before /health is reachable, we know it booted
  // and died — that's a fail, not a skip.
  interface ExitInfo { code: number | null; signal: NodeJS.Signals | null }
  let earlyExit: ExitInfo | null = null
  child.on('exit', (code, signal) => { earlyExit = { code, signal } as ExitInfo })

  const baseUrl = `http://127.0.0.1:${port}`
  const ready = await waitForHealth(baseUrl, readyTimeoutMs, () => earlyExit !== null)

  if (earlyExit !== null) {
    const exit: ExitInfo = earlyExit
    return {
      gate: 'scaffold-runs',
      status: 'fail',
      reason: `start-exited-early (code=${exit.code ?? 'null'} signal=${exit.signal ?? 'null'})`,
      stderr: stderrBuf.slice(-1000),
    }
  }

  if (!ready) {
    killProcess(child)
    return {
      gate: 'scaffold-runs',
      status: 'fail',
      reason: `health-endpoint-unreachable (${baseUrl}/health within ${readyTimeoutMs}ms)`,
      stderr: stderrBuf.slice(-1000),
    }
  }

  // Pass. Either hand the process to caller for gate 3, or SIGTERM now.
  if (options.keepProcess) {
    return {
      gate: 'scaffold-runs',
      status: 'pass',
      port,
      process: { pid: child.pid ?? -1, kill: () => killProcess(child) },
    }
  }
  killProcess(child)
  return { gate: 'scaffold-runs', status: 'pass', port }
}

function resolveScaffoldPort(manifest: Record<string, unknown>, override?: number): number {
  if (override) return override
  const defaults = manifest.defaults as Record<string, unknown> | undefined
  // agent-eval uses `evalPort`; generic scaffolds use `port`. Accept both.
  const raw = defaults?.port ?? defaults?.evalPort
  if (raw != null) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 3100
}

async function waitForHealth(baseUrl: string, timeoutMs: number, exited: () => boolean): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (exited()) return false
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1500) })
      if (res.ok) return true
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

function killProcess(child: ReturnType<typeof spawn>): void {
  // Kill the process group. `pnpm start` spawns a child node which IS
  // the server; killing only the pnpm pid leaves the node child alive
  // and holding the port. SIGTERM first for clean shutdown, SIGKILL
  // follow-up after a short grace in case pnpm swallows SIGTERM
  // (observed with some npm/pnpm builds).
  try {
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* group may not exist */ }
      try { child.kill('SIGTERM') } catch { /* noop */ }
      setTimeout(() => {
        try { process.kill(-child.pid!, 'SIGKILL') } catch { /* already dead */ }
        try { child.kill('SIGKILL') } catch { /* noop */ }
      }, 500).unref()
    }
  } catch { /* already dead */ }
}

// ──────────────────────────────────────────────────────────────────
// Gate 3 — eval-scores
// ──────────────────────────────────────────────────────────────────

export interface EvalScoresOptions {
  /** Port where the agent is already listening (from gate 2). */
  port: number
  /** Max time for the eval harness to finish. */
  timeoutMs?: number
}

/**
 * If the scaffold composed `capability:agent-eval`, run its own
 * `tests/eval/run-eval.mjs --no-spawn --base <url>` against the
 * already-booted agent (gate 2 hands the port in). Read
 * `.evolve/eval/latest.json`, assert aggregate ≥ manifest threshold
 * (fall back to 0.7).
 *
 * Why reuse the booted process from gate 2: the eval runner's default
 * lifecycle spawns the agent itself, but we already have it running.
 * Passing `--no-spawn` tells it to skip spawn and talk to `--base`.
 * This matches how a user would run `run-eval.mjs` against a local
 * dev server, which is the scenario we're dogfooding.
 *
 * Skip conditions:
 *   - scaffold did not compose capability:agent-eval (check
 *     composedLayers arg).
 *   - run-eval.mjs is missing (defensive — should not happen if the
 *     capability composed).
 */
export async function checkEvalScores(args: {
  composedDir: string
  manifest: Record<string, unknown>
  composedLayers: string[]
  options: EvalScoresOptions
}): Promise<EvalScoresResult> {
  const { composedDir, manifest, composedLayers, options } = args

  if (!composedLayers.some((l) => l === 'capability:agent-eval' || l.endsWith(':agent-eval'))) {
    return {
      gate: 'eval-scores',
      status: 'skipped',
      reason: 'no-agent-eval-capability',
    }
  }

  const runnerPath = join(composedDir, 'tests/eval/run-eval.mjs')
  if (!existsSync(runnerPath)) {
    return {
      gate: 'eval-scores',
      status: 'skipped',
      reason: 'no-run-eval-script',
    }
  }

  const threshold = resolveEvalThreshold(manifest)
  const baseUrl = `http://127.0.0.1:${options.port}`
  const timeoutMs = options.timeoutMs ?? 120_000

  // Spawn run-eval.mjs. Unlike gate 2 this awaits completion.
  const runnerRes = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(
      'node',
      ['tests/eval/run-eval.mjs', '--no-spawn', '--base', baseUrl, '--threshold', String(threshold)],
      { cwd: composedDir, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8') })
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8') })
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* noop */ }
    }, timeoutMs)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
  })

  // Read the scorecard — run-eval.mjs writes to .evolve/eval/latest.json
  // inside the scaffold dir.
  const scorecardPath = join(composedDir, '.evolve/eval/latest.json')
  let scorecard: { aggregate?: number; scenarios?: Array<{ id?: string; pass?: boolean }> } | null = null
  if (existsSync(scorecardPath)) {
    try { scorecard = JSON.parse(readFileSync(scorecardPath, 'utf8')) } catch { /* leave null */ }
  }

  if (!scorecard) {
    return {
      gate: 'eval-scores',
      status: 'fail',
      threshold,
      reason: `run-eval exited ${runnerRes.code} but no .evolve/eval/latest.json produced. stderr tail: ${runnerRes.stderr.slice(-500)}`,
    }
  }

  const aggregate = typeof scorecard.aggregate === 'number' ? scorecard.aggregate : 0
  const failing = (scorecard.scenarios ?? [])
    .filter((s) => s && s.pass === false)
    .map((s) => s.id ?? '(unnamed)')

  if (aggregate < threshold) {
    return {
      gate: 'eval-scores',
      status: 'fail',
      aggregate,
      threshold,
      failing,
      message: `aggregate ${aggregate.toFixed(2)} < threshold ${threshold.toFixed(2)} (failing scenarios: ${failing.join(', ') || 'none'})`,
    }
  }

  return {
    gate: 'eval-scores',
    status: 'pass',
    aggregate,
    threshold,
    failing,
  }
}

function resolveEvalThreshold(manifest: Record<string, unknown>): number {
  const defaults = manifest.defaults as Record<string, unknown> | undefined
  const raw = defaults?.evalThreshold
  if (raw != null) {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  }
  return 0.7
}
