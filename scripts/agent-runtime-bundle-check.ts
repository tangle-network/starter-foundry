#!/usr/bin/env tsx
// Gen 11 — bundle-check for agent-runtime scaffolds. Stand-in for `tsc --noEmit`
// when the bundle's primary content is markdown + YAML/TOML config rather than
// compilable code. Runs the same gate-2 validators that live in src/lib/validate.ts
// (prompt-frontmatter-valid, cron-syntax-valid, template-index-valid) plus a few
// safety/anti-bomb checks that don't need to be in every scaffold's manifest.
//
// Exit codes:
//   0 — bundle passes all checks
//   1 — bundle defect (one or more checks failed; reasons printed to stderr)
//   2 — checker itself crashed (uncaught exception); distinct from defect-fail
//       so the calling harness can escalate (operator inspection) instead of
//       treating it as a bundle issue.
//
// Usage:
//   tsx scripts/agent-runtime-bundle-check.ts <bundleDir>
//   tsx scripts/agent-runtime-bundle-check.ts .          # current directory
//
// Listed in src/eval/scaffold-bridge.ts:HARNESS_CONFIGS.markdown.testCommand
// and exercised by tests/agent-runtime-bundle-check.test.ts.

import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { validateComposedDir } from '../src/lib/validate.js'
import type { ValidationCheck } from '../src/types.js'

// Distinct exit codes. Keep these as constants so the test asserts on them
// (and so any future caller that programmatically interprets the exit knows
// exactly what 1 vs 2 mean).
const EXIT_OK = 0
const EXIT_BUNDLE_DEFECT = 1
const EXIT_CHECKER_CRASH = 2

// Hard upper bound on any single file. 10 MB is generous for markdown +
// config; anything larger is either a binary asset that doesn't belong in
// a bundle, or a YAML/JSON bomb. Catches the negative cases from the
// Gen 11 Phase 1.5 review.
const MAX_FILE_BYTES = 10 * 1024 * 1024

// Crash handler — turns any uncaught exception into a clean exit 2.
// The harness then knows the failure is in the checker, not the bundle.
process.on('uncaughtException', (err) => {
  process.stderr.write(
    `agent-runtime-bundle-check: uncaught exception: ${(err as Error).stack ?? err}\n`,
  )
  process.exit(EXIT_CHECKER_CRASH)
})
process.on('unhandledRejection', (reason) => {
  process.stderr.write(
    `agent-runtime-bundle-check: unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}\n`,
  )
  process.exit(EXIT_CHECKER_CRASH)
})

const bundleDirArg = process.argv[2] ?? '.'
const bundleDir = resolve(bundleDirArg)

if (!existsSync(bundleDir)) {
  process.stderr.write(`agent-runtime-bundle-check: bundle dir does not exist: ${bundleDir}\n`)
  process.exit(EXIT_BUNDLE_DEFECT)
}

const failures: string[] = []

// ── 1. Required structural files ────────────────────────────────────────

const REQUIRED_FILES = ['system-prompt.md', 'templates/index.json']

for (const rel of REQUIRED_FILES) {
  const abs = join(bundleDir, rel)
  if (!existsSync(abs)) {
    failures.push(`required file missing: ${rel}`)
  }
}

// ── 2. Anti-bomb scan: no symlinks outside the bundle, no oversized files ──

function walkBundle(
  dir: string,
  into: { rel: string; abs: string; lstat: ReturnType<typeof lstatSync> }[],
): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    failures.push(
      `cannot read directory ${relative(bundleDir, dir) || '.'}: ${(err as Error).message}`,
    )
    return
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git' || name === '.starter-foundry') continue
    const abs = join(dir, name)
    let l: ReturnType<typeof lstatSync>
    try {
      l = lstatSync(abs)
    } catch (err) {
      failures.push(`cannot stat ${relative(bundleDir, abs)}: ${(err as Error).message}`)
      continue
    }
    const rel = relative(bundleDir, abs)
    into.push({ rel, abs, lstat: l })
    if (l.isDirectory()) walkBundle(abs, into)
  }
}

const allEntries: { rel: string; abs: string; lstat: ReturnType<typeof lstatSync> }[] = []
walkBundle(bundleDir, allEntries)

for (const entry of allEntries) {
  if (entry.lstat.isSymbolicLink()) {
    // Resolve the target; if it resolves outside the bundle dir, fail.
    let target: string
    try {
      target = resolve(entry.abs, '..', readFileSync(entry.abs, 'utf8').trim())
    } catch {
      // Can't read symlink contents — skip rather than crash; a missing
      // symlink target is its own defect class but not what we test here.
      continue
    }
    const rootResolved = resolve(bundleDir)
    if (!target.startsWith(rootResolved)) {
      failures.push(`symlink ${entry.rel} points outside bundle (${target})`)
    }
  } else if (entry.lstat.isFile()) {
    if (entry.lstat.size > MAX_FILE_BYTES) {
      failures.push(
        `file ${entry.rel} exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB cap (size: ${(entry.lstat.size / 1024 / 1024).toFixed(2)} MB)`,
      )
    }
    // Quick null-byte / non-UTF8 check on small text-shaped files. Larger
    // binary assets (png, mp4, etc.) are allowed under the size cap; only
    // .md/.json/.yaml/.toml/.ts files are inspected.
    const ext = entry.rel.slice(entry.rel.lastIndexOf('.'))
    if (['.md', '.json', '.yaml', '.yml', '.toml', '.ts', '.tsx', '.js', '.mjs'].includes(ext)) {
      if (entry.lstat.size === 0) {
        failures.push(`file ${entry.rel} is empty (zero bytes) — likely incomplete`)
      } else {
        let buf: Buffer
        try {
          buf = readFileSync(entry.abs)
        } catch {
          failures.push(`cannot read ${entry.rel}`)
          continue
        }
        if (buf.includes(0)) {
          failures.push(`file ${entry.rel} contains null bytes — likely binary or corrupted`)
        }
      }
    }
  }
}

// ── 3. Substrate-shape validators (re-use src/lib/validate.ts logic) ─────

if (failures.length === 0) {
  // Only run the substrate validators if the structural pre-checks all pass.
  // Saves redundant errors when the bundle is fundamentally broken.
  const checks: ValidationCheck[] = []

  if (existsSync(join(bundleDir, 'system-prompt.md'))) {
    checks.push({ type: 'prompt-frontmatter-valid', path: 'system-prompt.md' })
  }
  if (existsSync(join(bundleDir, 'templates/index.json'))) {
    checks.push({ type: 'template-index-valid', path: 'templates/index.json' })
  }
  if (existsSync(join(bundleDir, 'wrangler.toml'))) {
    checks.push({ type: 'cron-syntax-valid', path: 'wrangler.toml' })
  }

  try {
    const result = await validateComposedDir({ composedDir: bundleDir, checks })
    for (const c of result.checks) {
      if (!c.ok)
        failures.push(
          `${c.check.type}${c.check.path ? ` ${c.check.path}` : ''}: ${c.error ?? 'failed'}`,
        )
    }
  } catch (err) {
    // Validator crash → checker crash, not bundle defect.
    process.stderr.write(
      `agent-runtime-bundle-check: validator threw: ${(err as Error).stack ?? err}\n`,
    )
    process.exit(EXIT_CHECKER_CRASH)
  }
}

// ── Report ──────────────────────────────────────────────────────────────

if (failures.length > 0) {
  process.stderr.write(
    `agent-runtime-bundle-check: ${failures.length} check(s) failed in ${bundleDir}\n`,
  )
  for (const f of failures) process.stderr.write(`  ✗ ${f}\n`)
  process.exit(EXIT_BUNDLE_DEFECT)
}

const fileCount = allEntries.filter((e) => e.lstat.isFile()).length
process.stdout.write(
  `agent-runtime-bundle-check: PASS (${fileCount} files inspected, all checks ok)\n`,
)
process.exit(EXIT_OK)
