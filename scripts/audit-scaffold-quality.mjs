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
// Gen-1 verifier extensions — each gated by a flag so retries + existing
// callers don't pick up stricter grading inadvertently.
const doBuild = process.argv.includes('--build')
const doValidation = process.argv.includes('--validation-checks')
const doSmoke = process.argv.includes('--smoke-compose')
const buildTimeoutMs = Number.parseInt(arg('--build-timeout', '180000'), 10)
const validationTimeoutMs = Number.parseInt(arg('--validation-timeout', '60000'), 10)

// Security gate for validationChecks: only run `command-success` entries
// whose first token is in this allowlist. A hostile manifest can't turn
// this into an arbitrary-exec vector.
const VALIDATION_CMD_ALLOWLIST = new Set([
  'node', 'pnpm', 'npm', 'yarn', 'tsx', 'python3', 'python', 'go',
  'cargo', 'forge', 'aptos', 'sui', 'bash', 'sh',
])

const registry = await loadRegistry()

const frameworks = [...registry.layers.values()].filter((l) => l.group === 'framework')
const filtered = onlyLayer ? frameworks.filter((f) => `${f.group}:${f.id}` === onlyLayer) : frameworks

console.log(`auditing ${filtered.length} framework layers...`)

function runCmd(cmd, args, cwd, perCallTimeoutMs) {
  const t0 = performance.now()
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    timeout: perCallTimeoutMs ?? timeoutMs,
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
  // Aptos / Sui Move projects use Move.toml at the project root; both CLIs
  // compile through `<cli> move compile`. Aptos-first because it's the more
  // common toolchain across starter-foundry's current Move families.
  if (existsSync(join(dir, 'Move.toml'))) {
    if (existsSync('/opt/homebrew/bin/aptos') || existsSync('/usr/local/bin/aptos')) {
      return { cmd: 'aptos', install: ['move', 'compile', '--dev'] }
    }
    if (existsSync('/opt/homebrew/bin/sui') || existsSync('/usr/local/bin/sui')) {
      return { cmd: 'sui', install: ['move', 'build'] }
    }
  }
  // ROS2 ament packages — `package.xml` + `setup.py` or CMakeLists.txt. If
  // `colcon` is on PATH, use it; otherwise fall back to compile-checking the
  // Python entrypoint so the scaffold still gets *some* verification signal.
  if (existsSync(join(dir, 'package.xml'))) {
    if (existsSync('/opt/homebrew/bin/colcon') || existsSync('/usr/local/bin/colcon')) {
      return { cmd: 'colcon', install: ['build', '--merge-install'] }
    }
    if (existsSync(join(dir, 'setup.py'))) {
      return { cmd: 'python3', install: ['-m', 'compileall', '.'] }
    }
  }
  if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'requirements.txt'))) {
    return { cmd: 'python3', install: ['-m', 'compileall', '.'] }
  }
  // Kotlin/Gradle — check gradle wrapper before global gradle.
  if (existsSync(join(dir, 'build.gradle.kts')) || existsSync(join(dir, 'build.gradle'))) {
    if (existsSync(join(dir, 'gradlew'))) return { cmd: './gradlew', install: ['compileKotlin', '--no-daemon'] }
    if (existsSync('/opt/homebrew/bin/gradle') || existsSync('/usr/local/bin/gradle')) {
      return { cmd: 'gradle', install: ['compileKotlin', '--no-daemon'] }
    }
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

  // Gen-1: --build phase. Runs the scaffold's own `build` script (typically
  // `pnpm run build` or `pnpm build`). Catches bundler errors, dead imports,
  // missing public assets — classes of bug that typecheck alone misses.
  // Only runs when install + typecheck pass; skipped if no `build` script.
  if (doBuild && install.exitCode === 0 && pm.cmd === 'pnpm' && phases.every((p) => p.ok || p.skipped)) {
    const pkgPath = join(tmp, 'package.json')
    let hasBuild = false
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      hasBuild = typeof pkg.scripts?.build === 'string'
    } catch {
      /* treat as no build script */
    }
    if (hasBuild) {
      const build = runCmd('pnpm', ['run', 'build'], tmp, buildTimeoutMs)
      phases.push({
        phase: 'build',
        cmd: 'pnpm run build',
        ok: build.exitCode === 0,
        durationMs: build.durationMs,
        stderrTail: build.stderrTail.slice(-2000),
        stdoutTail: build.stdoutTail.slice(-2000),
      })
    } else {
      phases.push({ phase: 'build', skipped: 'no-build-script', ok: true })
    }
  }

  // Gen-1: --validation-checks phase. Runs the family's declared
  // validationChecks from registry/families/<id>/manifest.json. Each check
  // is either a file-exists (deterministic path check) or a command-success
  // (spawn a whitelisted command, check expected output substring).
  if (doValidation && install.exitCode === 0 && phases.every((p) => p.ok || p.skipped)) {
    const famManifestPath = join('registry/families', family, 'manifest.json')
    let checks = []
    try {
      const fam = JSON.parse(readFileSync(famManifestPath, 'utf8'))
      if (Array.isArray(fam.validationChecks)) checks = fam.validationChecks
    } catch {
      /* family has no validationChecks — skip */
    }
    if (checks.length === 0) {
      phases.push({ phase: 'validationChecks', skipped: 'none-declared', ok: true })
    } else {
      const checkResults = []
      for (const check of checks) {
        if (check.type === 'file-exists' && typeof check.path === 'string') {
          const ok = existsSync(join(tmp, check.path))
          checkResults.push({ kind: 'file-exists', path: check.path, ok })
        } else if (check.type === 'command-success' && Array.isArray(check.command)) {
          const cmdHead = check.command[0]
          if (!VALIDATION_CMD_ALLOWLIST.has(cmdHead)) {
            checkResults.push({ kind: 'command-success', cmd: check.command.join(' '), ok: false, reason: 'not-whitelisted' })
            continue
          }
          const res = runCmd(cmdHead, check.command.slice(1), tmp, validationTimeoutMs)
          const expectedSub = typeof check.expect === 'string' ? check.expect : null
          const exitOk = res.exitCode === 0
          const subOk = expectedSub === null ? true : (res.stdoutTail + res.stderrTail).includes(expectedSub)
          checkResults.push({
            kind: 'command-success',
            cmd: check.command.join(' '),
            ok: exitOk && subOk,
            exitCode: res.exitCode,
            durationMs: res.durationMs,
            stderrTail: res.stderrTail.slice(-400),
          })
        } else {
          checkResults.push({ kind: 'unknown', type: check.type, ok: false, reason: 'unknown-check-type' })
        }
      }
      const passCount = checkResults.filter((r) => r.ok).length
      phases.push({
        phase: 'validationChecks',
        cmd: `${checks.length} check(s)`,
        ok: passCount === checkResults.length,
        durationMs: 0,
        checksTotal: checkResults.length,
        checksPassed: passCount,
        results: checkResults,
      })
    }
  }

  // Gen-1: --smoke-compose phase. Compose the family with one representative
  // multi-layer spec per surface (from taxonomy.surface). Catches integration
  // breakage that framework-in-isolation compose hides. Only runs install +
  // typecheck on the composed spec (not build — would be too slow per family).
  if (doSmoke && install.exitCode === 0) {
    const famManifestPath2 = join('registry/families', family, 'manifest.json')
    let surface = null
    try {
      const fam = JSON.parse(readFileSync(famManifestPath2, 'utf8'))
      surface = fam.taxonomy?.surface ?? null
    } catch { /* no family manifest */ }

    const smokeLayers =
      surface === 'frontend' ? [`framework:${family}`, 'capability:tailwind']
      : surface === 'api' ? [`framework:${family}`]
      : [`framework:${family}`]

    const smokeSpec = {
      projectName: `smoke-${layer.id}`,
      family,
      layers: smokeLayers,
      partner: null,
      slots: {},
      variables: {},
    }
    const smokeTmp = mkdtempSync(join(tmpdir(), `smoke-${layer.id}-`))
    const smokeSpecPath = join(smokeTmp, 'spec.json')
    writeFileSync(smokeSpecPath, JSON.stringify(smokeSpec))

    const smokeCompose = runCmd('node', ['dist/cli.js', 'compose', '--spec', smokeSpecPath, '--out', smokeTmp, '--json'], '.')
    if (smokeCompose.exitCode !== 0) {
      phases.push({
        phase: 'smoke-compose',
        cmd: `compose framework:${family} + ${smokeLayers.slice(1).join(', ') || '(alone)'}`,
        ok: false,
        stderrTail: smokeCompose.stderrTail.slice(-800),
      })
    } else {
      const smokePm = detectPackageManager(smokeTmp)
      if (smokePm) {
        const smokeInstall = runCmd(smokePm.cmd, smokePm.install, smokeTmp)
        phases.push({
          phase: 'smoke-compose',
          cmd: `compose + ${smokePm.cmd} ${smokePm.install.join(' ')}`,
          ok: smokeInstall.exitCode === 0,
          durationMs: smokeInstall.durationMs,
          stderrTail: smokeInstall.stderrTail.slice(-800),
        })
      } else {
        phases.push({ phase: 'smoke-compose', skipped: 'no-package-manager-after-compose', ok: true })
      }
    }
    try { rmSync(smokeTmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }) } catch {}
  }

  audits.push({ layerId, family, pm: pm.cmd, phases })
  try {
    rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
  } catch {
    // Cargo build artifacts can hold transient locks; leaking the temp dir
    // is strictly better than crashing the audit mid-run.
  }

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
