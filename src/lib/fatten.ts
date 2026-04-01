import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readJson } from './fs.js'

interface FattenResult {
  outDir: string
  hadDeps: boolean
  installed: boolean
  vitePrebundled: boolean
  built: boolean
  durationMs: number
}

function run(command: string, cwd: string, timeoutMs = 120000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => { child.kill('SIGTERM'); resolve({ ok: false, stdout, stderr: `${stderr}\ntimeout after ${timeoutMs}ms` }) }, timeoutMs)
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, stdout, stderr }) })
    child.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, stdout, stderr: err.message }) })
  })
}

/**
 * Fatten a composed scaffold directory by installing dependencies,
 * pre-bundling Vite, and optionally pre-building.
 *
 * After fattening, the directory contains node_modules/, .vite/ cache,
 * and optionally dist/ or .next/. A tarball of this directory lets the
 * dev server start instantly in the container.
 *
 * This is an OFFLINE operation — runs during scaffold publishing, not
 * in the user's hot path.
 */
export async function fattenStarter(outDir: string): Promise<FattenResult> {
  const start = performance.now()
  const result: FattenResult = {
    outDir,
    hadDeps: false,
    installed: false,
    vitePrebundled: false,
    built: false,
    durationMs: 0,
  }

  // Check if there's a package.json with dependencies
  const pkgPath = path.join(outDir, 'package.json')
  try {
    const pkg = await readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(pkgPath)
    const depCount = Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length
    result.hadDeps = depCount > 0
  } catch {
    result.durationMs = Math.round(performance.now() - start)
    return result
  }

  if (!result.hadDeps) {
    result.durationMs = Math.round(performance.now() - start)
    return result
  }

  // Step 1: Install dependencies
  const install = await run('pnpm install --frozen-lockfile 2>/dev/null || pnpm install --no-frozen-lockfile', outDir)
  result.installed = install.ok

  if (!result.installed) {
    result.durationMs = Math.round(performance.now() - start)
    return result
  }

  // Step 2: Pre-bundle Vite dependencies (creates node_modules/.vite/)
  const hasViteConfig = await fs.access(path.join(outDir, 'vite.config.ts')).then(() => true).catch(() => false)
    || await fs.access(path.join(outDir, 'vite.config.js')).then(() => true).catch(() => false)

  if (hasViteConfig) {
    const viteOptimize = await run('npx vite optimize', outDir, 30000)
    result.vitePrebundled = viteOptimize.ok
  }

  // Step 3: Pre-build (creates dist/ or .next/)
  const hasNextConfig = await fs.access(path.join(outDir, 'next.config.ts')).then(() => true).catch(() => false)
    || await fs.access(path.join(outDir, 'next.config.js')).then(() => true).catch(() => false)
    || await fs.access(path.join(outDir, 'next.config.mjs')).then(() => true).catch(() => false)

  if (hasNextConfig) {
    const build = await run('npx next build', outDir, 60000)
    result.built = build.ok
  } else if (hasViteConfig) {
    const build = await run('npx vite build', outDir, 30000)
    result.built = build.ok
  }

  result.durationMs = Math.round(performance.now() - start)
  return result
}
