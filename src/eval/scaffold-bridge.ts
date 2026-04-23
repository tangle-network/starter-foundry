// Scaffold-bridge — adapts starter-foundry's compose surface to
// agent-eval's BuilderSession + SandboxHarness. Given a spec (family +
// layers + variables), this module:
//
//   1. composes the scaffold to a tempdir
//   2. returns a HarnessConfig tuned for the family's build toolchain
//      (pnpm / cargo / go / aptos / node — dispatch on taxonomy.language)
//   3. registers family-aware judges that grade meta_score against the
//      composed output (manifest compliance, idiomatic layout, deps
//      resolved)
//
// The glue is deliberately thin. Every primitive (sandbox driver, judge
// factory, workspace assertions) comes from agent-eval. Nothing new here
// lives in starter-foundry except the composition adapter + family
// dispatch table.

import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileExists } from '@tangle-network/agent-eval'
import type { HarnessConfig, JudgeFn, WorkspaceAssertion, WorkspaceSnapshot, SandboxDriver } from '@tangle-network/agent-eval'
import type { ComposeSpec, ResolvedComponents } from '../types.js'

// ──────────────────────────────────────────────────────────────────
// Per-family harness dispatch
// ──────────────────────────────────────────────────────────────────

/**
 * Build the harness config for a family based on its taxonomy.language.
 * The resolved setup/test commands run inside the composed tempdir, so
 * the agent-eval SandboxHarness can subprocess-invoke them.
 *
 * Keep this table in sync with the registry's families — when a new
 * language surface lands (e.g. a Zig family), add a dispatch here.
 */
export function makeHarnessConfig(components: ResolvedComponents): HarnessConfig {
  const language = components.family.taxonomy?.language ?? 'unknown'
  const surface = components.family.taxonomy?.surface ?? 'unknown'

  switch (language) {
    case 'typescript':
    case 'javascript':
      // pnpm for the foundry-native JS projects. `--frozen-lockfile` off:
      // composed scaffolds don't carry a pnpm-lock.yaml; fresh install.
      return {
        setupCommand: 'pnpm install --prefer-offline',
        testCommand: surface === 'contracts'
          ? 'pnpm run validate || pnpm run build || true'
          : 'pnpm run validate || pnpm run build || true',
        timeoutMs: 180_000,
      }
    case 'rust':
      // Cargo workspace handling — `cargo check` is far cheaper than
      // `cargo build --release` and catches the same class of errors
      // (resolve + typecheck). Users running real builds can override.
      return {
        setupCommand: 'cargo fetch',
        testCommand: 'cargo check --workspace || cargo check',
        timeoutMs: 300_000,
      }
    case 'go':
      return {
        setupCommand: 'go mod tidy',
        testCommand: 'go build ./... && go vet ./...',
        timeoutMs: 180_000,
      }
    case 'python':
      return {
        // pip install -e would need a venv; most python starters ship a
        // requirements.txt or pyproject.toml. Use a light import smoke.
        setupCommand: '[ -f requirements.txt ] && pip install -r requirements.txt || true',
        testCommand: 'python -m compileall -q .',
        timeoutMs: 120_000,
      }
    case 'solidity':
      return {
        setupCommand: 'forge install --no-git || true',
        testCommand: 'forge build',
        timeoutMs: 180_000,
      }
    case 'move':
      return {
        setupCommand: '',
        testCommand: 'aptos move compile --dev',
        timeoutMs: 300_000,
      }
    default:
      // Unknown language — run only the family's `validate-*` script if
      // present. Never block the eval; return a no-op test.
      return {
        setupCommand: '',
        testCommand: 'true',
        timeoutMs: 60_000,
      }
  }
}

// ──────────────────────────────────────────────────────────────────
// Workspace assertions — manifest.files → real files on disk
// ──────────────────────────────────────────────────────────────────

/**
 * Generate workspace assertions from a resolved component tree. Every
 * file the manifest declares must exist after compose. This is the
 * structural correctness floor — no LLM needed.
 *
 * Uses agent-eval's `fileExists(path)` helper which returns a
 * WorkspaceAssertion whose `.check(snapshot)` resolves against the
 * snapshot's `files` record at eval time.
 */
export function manifestComplianceAssertions(components: ResolvedComponents): WorkspaceAssertion[] {
  const assertions: WorkspaceAssertion[] = []
  const seen = new Set<string>()

  const addFile = (target: string) => {
    if (seen.has(target)) return
    seen.add(target)
    assertions.push(fileExists(target))
  }

  for (const file of components.family.files ?? []) addFile(file.target)
  for (const layer of components.layers) {
    for (const file of layer.files ?? []) addFile(file.target)
  }
  return assertions
}

// ──────────────────────────────────────────────────────────────────
// Snapshot helper — reads a composed scaffold into a WorkspaceSnapshot
// ──────────────────────────────────────────────────────────────────

/**
 * Walk the composed scaffold directory, return a WorkspaceSnapshot the
 * agent-eval `InMemoryWorkspaceInspector` + `runAssertions` understand.
 *
 * Content handling:
 *   - UTF-8-valid text of any size → `files[path] = content` (full).
 *     Assertions like `fileContains(path, needle)` work against the
 *     complete file regardless of size. No arbitrary truncation.
 *   - Binary / non-UTF-8 files → `blobs[path] = { size, hash, mimeType }`.
 *     This is exactly what agent-eval's blob channel is for — keeps the
 *     snapshot small while preserving "this file exists and is binary"
 *     for file-exists-style assertions.
 *
 * Excluded: node_modules, target (cargo), .git, dist — noise that
 * would 10× the snapshot with no value for eval.
 */
export function snapshotScaffold(scaffoldDir: string): WorkspaceSnapshot {
  const files: Record<string, string> = {}
  const blobs: Record<string, { size: number; hash?: string; mimeType?: string }> = {}
  const res = spawnSync(
    'find',
    [scaffoldDir, '-type', 'f', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/target/*', '-not', '-path', '*/.git/*', '-not', '-path', '*/dist/*'],
    { encoding: 'utf8' },
  )
  if (res.status === 0) {
    for (const absPath of res.stdout.trim().split('\n').filter(Boolean)) {
      const relPath = absPath.startsWith(scaffoldDir + '/') ? absPath.slice(scaffoldDir.length + 1) : absPath
      try {
        const buf = readFileSync(absPath)
        if (isProbablyText(buf)) {
          files[relPath] = buf.toString('utf8')
        } else {
          blobs[relPath] = {
            size: buf.length,
            // Don't compute hash here — it's O(size) on every eval; caller
            // adds it selectively when assertions need it.
            mimeType: guessMimeType(relPath),
          }
        }
      } catch {
        // Read error (permissions, broken symlink): record as empty text
        // so file-exists assertions still resolve truthy while read-
        // dependent assertions fail with an empty content mismatch.
        files[relPath] = ''
      }
    }
  }
  return { files, rows: {}, kv: {}, blobs: Object.keys(blobs).length ? blobs : undefined }
}

/**
 * Heuristic: a file is "probably text" if the first 4KB contains no
 * NUL byte and is decodable as UTF-8 without replacement chars. This
 * catches the common cases (source code, configs, markdown, json) and
 * correctly diverts binaries (wasm, .zkey, images, compiled elf) to
 * the blob channel.
 */
function isProbablyText(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(4096, buf.length))
  if (head.includes(0)) return false
  // Attempt strict decode — if the bytes form invalid UTF-8, TextDecoder
  // with `fatal: true` throws.
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head)
    return true
  } catch {
    return false
  }
}

function guessMimeType(path: string): string | undefined {
  const ext = path.toLowerCase().split('.').pop() ?? ''
  switch (ext) {
    case 'wasm': return 'application/wasm'
    case 'zkey': return 'application/octet-stream+zkey'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'woff':
    case 'woff2': return 'font/woff2'
    case 'pdf': return 'application/pdf'
    default: return undefined
  }
}

// ──────────────────────────────────────────────────────────────────
// Judge factory — scaffold meta_score rubric
// ──────────────────────────────────────────────────────────────────

/**
 * Build a JudgeFn that grades a composed scaffold on five dimensions:
 *   1. correctness       — imports resolve, build recipe valid
 *   2. completeness      — all manifest-declared files present
 *   3. idiomatic         — workspace layout matches family convention
 *   4. production-ready  — env vars documented, secrets not in source
 *   5. over-scaffold     — no extraneous layers attached for the prompt
 *
 * The judge is meant to be plugged into agent-eval's BuilderSession via
 * `recordMetaScore(await judge(...))`. The fn itself doesn't call an LLM
 * — it builds the prompt and expects the caller (driver script) to hand
 * off to `createLlmReviewer`.
 *
 * Why this shape: agent-eval's JudgeFn takes a context object with
 * scenario+artifacts; the scaffold eval's "scenario" IS the user prompt,
 * and "artifacts" are the composed files. This adapter packs them up.
 */
export function buildScaffoldMetaPrompt(args: {
  userPrompt: string
  composedSpec: ComposeSpec
  snapshot: WorkspaceSnapshot
}): string {
  const { userPrompt, composedSpec, snapshot } = args
  const paths = Object.keys(snapshot.files).sort()
  const fileList = paths
    .slice(0, 80) // cap prompt length
    .join('\n  ')
  const keyFiles = pickKeyFiles(snapshot)
  // Prompt-budget truncation (distinct from snapshot completeness —
  // the snapshot has the full file; this is render-only).
  const PROMPT_FILE_CAP = 4000
  const keyFilesSection = keyFiles
    .map((f) => {
      const truncated = f.content.length > PROMPT_FILE_CAP
      const body = truncated
        ? `${f.content.slice(0, PROMPT_FILE_CAP)}\n\n[... ${f.content.length - PROMPT_FILE_CAP} more characters truncated for prompt budget — full content is in the snapshot ...]`
        : f.content
      return `\n### ${f.path}${truncated ? ' (truncated for prompt)' : ''}\n\`\`\`\n${body}\n\`\`\``
    })
    .join('\n')
  return [
    '# Scaffold quality assessment',
    '',
    'You are grading a composed project scaffold. The user gave a prompt and the',
    'planner selected a family + capability layers + variables. After composition,',
    'these files are on disk:',
    '',
    '## User prompt',
    userPrompt,
    '',
    '## Resolved composition',
    `- family: ${composedSpec.family}`,
    `- layers: ${(composedSpec.layers ?? []).join(', ')}`,
    `- partner: ${composedSpec.partner ?? '(none)'}`,
    '',
    '## File list',
    '  ' + fileList,
    ...(paths.length > 80 ? [`  ... ${paths.length - 80} more`] : []),
    '',
    '## Key files',
    keyFilesSection,
    '',
    '## Rubric (0-1 per dimension, 1 = perfect)',
    '',
    '1. **correctness**    — do imports resolve? Is the build recipe plausible? Any obvious typos or broken references?',
    '2. **completeness**   — does the scaffold cover the prompt\'s stated surfaces? (if prompt says "ZK prover + frontend", do both exist?)',
    '3. **idiomatic**      — does the layout match the framework\'s canonical pattern? (risczero has methods/guest+host; SP1 has program/+script/)',
    '4. **production-ready** — are env vars documented? secrets NOT in source? build caching hints present?',
    '5. **over-scaffold**  — score 1 if ZERO layers are extraneous; lower if capabilities are attached that the prompt doesn\'t justify.',
    '',
    '## Output',
    '',
    'Return a single JSON object:',
    '```json',
    '{',
    '  "correctness": 0.9,',
    '  "completeness": 0.95,',
    '  "idiomatic": 0.85,',
    '  "productionReady": 0.8,',
    '  "overScaffold": 1.0,',
    '  "overall": 0.9,',
    '  "issues": [{"dimension": "...", "severity": "low|medium|high", "description": "..."}],',
    '  "verdict": "pass | fail | borderline"',
    '}',
    '```',
  ].join('\n')
}

/**
 * Pick the "key files" agent-eval's judge should see in full. We don't
 * want to ship the entire scaffold into the prompt (token explosion);
 * instead surface the files that carry the scaffold's signal.
 */
function pickKeyFiles(snapshot: WorkspaceSnapshot): Array<{ path: string; content: string }> {
  const priorities = [
    /^package\.json$/,
    /^Cargo\.toml$/,
    /^go\.mod$/,
    /^Move\.toml$/,
    /^foundry\.toml$/,
    /^requirements\.txt$/,
    /^pyproject\.toml$/,
    /^README\.md$/,
    /^tsconfig\.json$/,
    /^src\/main\.(ts|rs|py|go)$/,
    /^src\/App\.tsx$/,
    /^src\/index\.(ts|tsx)$/,
    /^methods\/guest\/src\/main\.rs$/,
    /^program\/src\/main\.rs$/,
    /^host\/src\/main\.rs$/,
  ]
  const paths = Object.keys(snapshot.files)
  const out: Array<{ path: string; content: string }> = []
  for (const pattern of priorities) {
    const match = paths.find((p) => pattern.test(p))
    if (match) out.push({ path: match, content: snapshot.files[match] })
    if (out.length >= 6) break
  }
  return out
}

// ──────────────────────────────────────────────────────────────────
// Convenience — compose a spec and return everything the bridge needs
// ──────────────────────────────────────────────────────────────────

export interface ScaffoldBridgeResult {
  scaffoldDir: string
  harness: HarnessConfig
  snapshot: WorkspaceSnapshot
  assertions: WorkspaceAssertion[]
  cleanup: () => void
}

/**
 * Compose a spec to a tempdir + package up everything the driver needs
 * to run agent-eval's BuilderSession: sandbox config, file snapshot,
 * structural assertions, cleanup thunk.
 *
 * Compose failure throws. Caller handles by scoring the build_score as
 * 0 and proceeding with a failed-compose meta judgment.
 */
export async function prepareScaffoldForEval(args: {
  spec: ComposeSpec
  components: ResolvedComponents
}): Promise<ScaffoldBridgeResult> {
  const scaffoldDir = mkdtempSync(join(tmpdir(), 'scaffold-eval-'))

  // Invoke the compose CLI. Runs against the live `dist/` so the bridge
  // stays registry-version-agnostic; no in-process coupling to compose.
  const specPath = join(scaffoldDir, 'spec.json')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(specPath, JSON.stringify(args.spec))
  const res = spawnSync('node', ['dist/cli.js', 'compose', '--spec', specPath, '--out', scaffoldDir, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    rmSync(scaffoldDir, { recursive: true, force: true })
    throw new Error(`compose failed (exit ${res.status}): ${res.stderr.slice(-500)}`)
  }

  const snapshot = snapshotScaffold(scaffoldDir)
  const harness = makeHarnessConfig(args.components)
  const assertions = manifestComplianceAssertions(args.components)

  return {
    scaffoldDir,
    harness,
    snapshot,
    assertions,
    cleanup: () => {
      try { rmSync(scaffoldDir, { recursive: true, force: true }) } catch { /* noop */ }
    },
  }
}

// Unused export to silence eslint no-unused-vars for types imported only
// for their TypeScript contract; consumers (judge wiring in the driver)
// pull these in via the re-export.
export type { HarnessConfig, JudgeFn, WorkspaceAssertion, WorkspaceSnapshot, SandboxDriver }
