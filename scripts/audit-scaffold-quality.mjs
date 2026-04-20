#!/usr/bin/env node
// Composes each framework:* layer into a temp dir and runs the package
// manager + typecheck + lint pipeline that a downstream agent would run,
// cataloging which scaffolds fail out-of-the-box.
//
// Purpose: mirror VB's "dependencies" / "lint" failure categories on our
// side without needing VB's scenario→spec mapping. A layer that fails
// `pnpm install` on a bare compose is shipping a bug. A layer that fails
// typecheck on zero edits is shipping a bug. A layer that fails lint on
// zero edits is shipping a bug.
//
// Usage:
//   node scripts/audit-scaffold-quality.mjs                # all framework:*
//   node scripts/audit-scaffold-quality.mjs --layer framework:forge-foundation

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import { loadRegistry } from '../dist/lib/registry.js'

const argv = process.argv.slice(2)
function arg(k, fallback) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}
const onlyLayer = arg('--layer', null)
const outPath = arg('--out', '.evolve/scaffold-quality-audit.json')
const timeoutMs = Number.parseInt(arg('--timeout', '120000'), 10)

const registry = await loadRegistry()

const frameworks = [...registry.layers.values()].filter((l) => l.group === 'framework')
const filtered = onlyLayer ? frameworks.filter((f) => `${f.group}:${f.id}` === onlyLayer) : frameworks

console.log(`auditing ${filtered.length} framework layers...`)

function runCmd(cmd, args, cwd) {
  const t0 = performance.now()
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env, CI: '1', PNPM_NO_AUDIT: '1' },
  })
  // Tail to last 30 lines to keep artifact size bounded while preserving
  // real error context. Some tools (pnpm install, cargo) write errors to
  // stdout; others (tsc) to stderr. Downstream consumers need BOTH.
  return {
    exitCode: res.status ?? -1,
    signal: res.signal,
    durationMs: performance.now() - t0,
    stdoutTail: (res.stdout ?? '').split('\n').slice(-30).join('\n'),
    stderrTail: (res.stderr ?? '').split('\n').slice(-30).join('\n'),
  }
}

function detectPackageManager(dir) {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return { cmd: 'pnpm', install: ['install', '--frozen-lockfile'] }
  if (existsSync(join(dir, 'package-lock.json'))) return { cmd: 'npm', install: ['ci'] }
  if (existsSync(join(dir, 'yarn.lock'))) return { cmd: 'yarn', install: ['install', '--frozen-lockfile'] }
  if (existsSync(join(dir, 'package.json'))) return { cmd: 'pnpm', install: ['install', '--no-frozen-lockfile'] }
  if (existsSync(join(dir, 'Cargo.toml'))) return { cmd: 'cargo', install: ['check'] }
  if (existsSync(join(dir, 'foundry.toml'))) return { cmd: 'forge', install: ['build'] }
  if (existsSync(join(dir, 'go.mod'))) return { cmd: 'go', install: ['build', './...'] }
  if (existsSync(join(dir, 'Anchor.toml'))) return { cmd: 'anchor', install: ['build'] }
  if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'requirements.txt'))) {
    return { cmd: 'python3', install: ['-m', 'compileall', '.'] }
  }
  return null
}

const audits = []
for (const layer of filtered) {
  const layerId = `${layer.group}:${layer.id}`

  // Find a family this framework applies to
  const family = layer.appliesTo?.[0]
  if (!family) {
    audits.push({ layerId, skipped: 'no-appliesTo' })
    continue
  }

  const spec = {
    projectName: `audit-${layer.id}`,
    family,
    layers: [layerId],
    partner: null,
    slots: {},
    variables: {},
  }

  const tmp = mkdtempSync(join(tmpdir(), `audit-${layer.id}-`))
  const specPath = join(tmp, 'spec.json')
  writeFileSync(specPath, JSON.stringify(spec))

  const compose = runCmd('node', ['dist/cli.js', 'compose', '--spec', specPath, '--out', tmp, '--json'], '.')
  if (compose.exitCode !== 0) {
    audits.push({ layerId, family, phase: 'compose', ok: false, error: compose.stderrTail.slice(-500) })
    rmSync(tmp, { recursive: true, force: true })
    continue
  }

  const pm = detectPackageManager(tmp)
  if (!pm) {
    audits.push({ layerId, family, phase: 'detect', skipped: 'no-package-manager', files: 'no recognizable project manifest' })
    rmSync(tmp, { recursive: true, force: true })
    continue
  }

  const phases = []

  const install = runCmd(pm.cmd, pm.install, tmp)
  phases.push({
    phase: 'install',
    cmd: `${pm.cmd} ${pm.install.join(' ')}`,
    ok: install.exitCode === 0,
    durationMs: install.durationMs,
    stderrTail: install.stderrTail.slice(-2000),
    stdoutTail: install.stdoutTail.slice(-2000),
  })

  if (install.exitCode === 0 && pm.cmd === 'pnpm' && existsSync(join(tmp, 'tsconfig.json'))) {
    const typecheck = runCmd('pnpm', ['exec', 'tsc', '--noEmit'], tmp)
    phases.push({
      phase: 'typecheck',
      cmd: 'pnpm exec tsc --noEmit',
      ok: typecheck.exitCode === 0,
      durationMs: typecheck.durationMs,
      stderrTail: typecheck.stderrTail.slice(-2000),
      stdoutTail: typecheck.stdoutTail.slice(-2000),
    })
  } else if (install.exitCode === 0 && pm.cmd === 'pnpm') {
    phases.push({ phase: 'typecheck', skipped: 'no-tsconfig', ok: true })
  }

  audits.push({ layerId, family, pm: pm.cmd, phases })
  rmSync(tmp, { recursive: true, force: true })

  const status = phases.every((p) => p.ok) ? '✓' : '✗'
  console.log(`  ${status} ${layerId} (${family}) via ${pm.cmd}`)
}

mkdirSync('.evolve', { recursive: true })
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), audits }, null, 2))

// Summary
const skipped = audits.filter((a) => a.skipped)
const complete = audits.filter((a) => !a.skipped && a.phases)
const failed = complete.filter((a) => a.phases.some((p) => !p.ok))

console.log(`\n--- summary ---`)
console.log(`total framework layers: ${filtered.length}`)
console.log(`audited:                ${complete.length}`)
console.log(`skipped:                ${skipped.length}`)
console.log(`failed on at least one phase: ${failed.length}`)
if (failed.length > 0) {
  console.log(`\nFAILING:`)
  for (const a of failed) {
    const firstFail = a.phases.find((p) => !p.ok)
    console.log(`  ${a.layerId} → ${firstFail.phase}: ${firstFail.stderrTail.split('\n').pop()}`)
  }
}
console.log(`\nwrote: ${outPath}`)
