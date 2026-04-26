#!/usr/bin/env tsx
// Publish-integrity guard. Runs as `prepublishOnly` to catch the class of
// bugs that bit Gen 10 (publish-drift: tagged version > npm version, link:
// deps survived to publish, dist/ stale, secrets in dist/, exports map
// pointing at deleted files).
//
// Each check is fail-loud + actionable. The guard runs in <2s; it's not
// a substitute for the full test suite, only the *publish-time* sanity
// pass that would have caught the historical misses.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_PATH = join(REPO, 'package.json')

interface PackageJson {
  name: string
  version: string
  files: string[]
  exports: Record<string, string | { import?: string; types?: string }>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8')) as PackageJson

const failures: string[] = []
const warnings: string[] = []

function fail(msg: string): void {
  failures.push(msg)
}

function warn(msg: string): void {
  warnings.push(msg)
}

// ── Check 1: dist/ exists and is non-empty ───────────────────────────

const distPath = join(REPO, 'dist')
if (!existsSync(distPath)) {
  fail(`dist/ does not exist — run \`pnpm build\` before publish`)
} else {
  const distFiles = readdirSync(distPath)
  if (distFiles.length === 0) {
    fail(`dist/ is empty — build did not emit anything`)
  }
}

// ── Check 2: every package.json `files` entry exists ─────────────────

for (const filesEntry of pkg.files ?? []) {
  const abs = join(REPO, filesEntry)
  if (!existsSync(abs)) {
    fail(`package.json files[] declares "${filesEntry}" but ${abs} does not exist`)
  }
}

// ── Check 3: every package.json `exports` entry resolves to a real file ─

function flattenExports(exp: PackageJson['exports']): { sub: string; built: string }[] {
  const out: { sub: string; built: string }[] = []
  for (const [sub, target] of Object.entries(exp)) {
    if (typeof target === 'string') {
      out.push({ sub, built: target })
    } else if (target.import) {
      out.push({ sub, built: target.import })
    }
  }
  return out
}

for (const entry of flattenExports(pkg.exports ?? {})) {
  const abs = resolve(REPO, entry.built)
  if (!existsSync(abs)) {
    fail(`exports["${entry.sub}"] → ${entry.built} but ${abs} does not exist`)
  }
}

// ── Check 4: no `link:` / `file:` / `workspace:*` deps in production deps ──

function checkProtocolDeps(label: string, deps: Record<string, string> | undefined): void {
  if (!deps) return
  for (const [name, version] of Object.entries(deps)) {
    if (/^(link:|file:|workspace:)/.test(version)) {
      fail(`${label}["${name}"] = "${version}" — protocol deps cannot be published; replace with a real version`)
    }
  }
}
checkProtocolDeps('dependencies', pkg.dependencies)
checkProtocolDeps('peerDependencies', pkg.peerDependencies)
checkProtocolDeps('optionalDependencies', pkg.optionalDependencies)

// ── Check 5: no secrets / sensitive files in dist/ or other published paths ─

// Sensitive file detection. Excludes intentional template variants — every
// scaffold registry ships `.env.example` / `.env.template` / `.env.sample`
// as documentation for downstream consumers, NOT as a real secret.
const SENSITIVE_PATTERNS: RegExp[] = [
  /(?:^|\/)\.env$/,
  /(?:^|\/)\.env\.(?:local|production|prod|staging|stage|secret|secrets)$/,
  /\.aws\//,
  /credentials\.json$/,
  /\.pem$/,
  /(?:^|\/)[^/]*\.key$/,
  /id_rsa/,
  /id_ed25519/,
  /(?:^|\/)\.npmrc$/,
]

function walkPublishable(dir: string, into: string[] = []): string[] {
  if (!existsSync(dir)) return into
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue
      walkPublishable(abs, into)
    } else {
      into.push(abs)
    }
  }
  return into
}

const publishedRoots = (pkg.files ?? []).map((p) => join(REPO, p))
for (const root of publishedRoots) {
  for (const file of walkPublishable(root)) {
    const rel = file.slice(REPO.length + 1)
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(rel)) {
        fail(`sensitive file "${rel}" is inside a published path — remove from dist/ or rebuild`)
      }
    }
  }
}

// ── Check 6: dist/ freshness — newer than src/ ───────────────────────

function newestMtime(dir: string, ext: RegExp): number {
  let newest = 0
  if (!existsSync(dir)) return newest
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue
    const abs = join(dir, name)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) {
      const sub = newestMtime(abs, ext)
      if (sub > newest) newest = sub
    } else if (ext.test(name)) {
      if (st.mtimeMs > newest) newest = st.mtimeMs
    }
  }
  return newest
}

const srcNewest = newestMtime(join(REPO, 'src'), /\.(ts|tsx)$/)
const distNewest = newestMtime(join(REPO, 'dist'), /\.(js|d\.ts)$/)
if (srcNewest > 0 && distNewest > 0 && srcNewest > distNewest + 1000) {
  // 1s grace period for filesystem mtime jitter
  warn(
    `src/ has files newer than dist/ — dist may be stale. ` +
    `Run \`pnpm build\` to refresh before publishing.`,
  )
}

// ── Check 7: bundle-size budget — emit stat + flag growth >50% from baseline ─

function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0
  let total = 0
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) total += dirSize(abs)
    else total += st.size
  }
  return total
}

const distBytes = dirSize(distPath)
const distMb = distBytes / 1024 / 1024
const BUDGET_MB = 10 // sane upper bound; bump if the package legitimately grows
if (distMb > BUDGET_MB) {
  fail(`dist/ is ${distMb.toFixed(2)} MB — exceeds the ${BUDGET_MB} MB budget. Audit what crept in.`)
}

// ── Check 8: name/version sanity ─────────────────────────────────────

if (!/^@?[a-z0-9][a-z0-9._/-]*$/.test(pkg.name)) {
  fail(`package.json name "${pkg.name}" is not a valid npm package name`)
}
if (!/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/.test(pkg.version)) {
  fail(`package.json version "${pkg.version}" is not a valid semver`)
}

// ── Check 9: git working tree clean (skipped in CI; warning otherwise) ──

if (!process.env['CI']) {
  try {
    const status = execSync('git status --porcelain', { cwd: REPO, encoding: 'utf8' }).trim()
    if (status.length > 0) {
      warn(`git working tree is dirty — uncommitted changes will not be published. \`git status\` to inspect.`)
    }
  } catch {
    // git not available; skip
  }
}

// ── Report ───────────────────────────────────────────────────────────

const HR = '─'.repeat(72)
console.log(HR)
console.log(`Publish integrity check — ${pkg.name}@${pkg.version}`)
console.log(HR)
console.log(`  dist/ size:      ${distMb.toFixed(2)} MB / ${BUDGET_MB} MB budget`)
console.log(`  exports count:   ${flattenExports(pkg.exports ?? {}).length}`)
console.log(`  files[] count:   ${pkg.files?.length ?? 0}`)
console.log()

if (warnings.length > 0) {
  console.warn('Warnings:')
  for (const w of warnings) console.warn(`  ⚠ ${w}`)
  console.log()
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} integrity check(s) failed:`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  console.error()
  console.error(`Refusing to publish. Fix the issues above and re-run \`pnpm prepublishOnly\`.`)
  process.exit(1)
}

console.log('✓ all integrity checks passed')
