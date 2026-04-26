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

import { spawnSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fileExists } from '@tangle-network/agent-eval'
import type {
  HarnessConfig,
  JudgeFn,
  WorkspaceAssertion,
  WorkspaceSnapshot,
  SandboxDriver,
} from '@tangle-network/agent-eval'

import type { ComposeSpec, ResolvedComponents } from '../types.js'

// ──────────────────────────────────────────────────────────────────
// Per-family harness dispatch
// ──────────────────────────────────────────────────────────────────

/**
 * Per-language harness config table. Single source of truth — the
 * promoters (scripts/promote-family-proposal.ts,
 * scripts/promote-capability-proposal.ts) import this table rather
 * than redefining it. Gen 8b shipped when only two of three copies
 * got the strict-gate fix; centralizing removes the drift surface.
 *
 * Keys are `taxonomy.language` values. New languages must be added
 * here — `makeHarnessConfig` THROWS on unknown languages rather than
 * silently returning a no-op (which was the muffled-gate shape where
 * a Zig family silent-passed the build phase).
 *
 * `muffle-ok:` annotations mark places where a non-strict command
 * is intentional and documented.
 */
export const HARNESS_CONFIGS: Record<string, HarnessConfig> = {
  typescript: {
    setupCommand: 'pnpm install --prefer-offline',
    // Strict: tsc --noEmit fails loud on type errors. The previous
    // `pnpm run validate || pnpm run build || true` swallowed exit
    // codes and silent-passed broken React 17 / .ts-JSX scaffolds —
    // the Gen 8 Goodhart bug that triggered the compile-gate work.
    testCommand: 'pnpm exec tsc --noEmit',
    timeoutMs: 180_000,
  },
  javascript: {
    setupCommand: 'pnpm install --prefer-offline',
    // No tsc for JS; fall back to the build script. If a family lacks
    // a build script it must declare a validationCheck instead.
    testCommand: 'pnpm run build',
    timeoutMs: 180_000,
  },
  rust: {
    setupCommand: 'cargo fetch',
    // muffle-ok: `|| cargo check` is a narrower-scope retry for
    // non-workspace crates, not a pass-through. Both branches still
    // fail-loud on type errors.
    testCommand: 'cargo check --workspace || cargo check',
    timeoutMs: 300_000,
  },
  go: {
    setupCommand: 'go mod tidy',
    testCommand: 'go build ./... && go vet ./...',
    timeoutMs: 180_000,
  },
  python: {
    // muffle-ok: setup is best-effort — if requirements.txt is
    // absent, skip install. The testCommand (compileall) still
    // fail-louds on syntax errors regardless of install outcome.
    setupCommand: '[ -f requirements.txt ] && pip install -r requirements.txt || true', // muffle-ok: best-effort install; compileall is the real gate
    testCommand: 'python -m compileall -q .',
    timeoutMs: 120_000,
  },
  solidity: {
    // muffle-ok: forge install is best-effort; if deps are vendored
    // it may not be needed. `forge build` is the real gate.
    setupCommand: 'forge install --no-git || true', // muffle-ok: setup is best-effort; forge build is the real gate
    testCommand: 'forge build',
    timeoutMs: 180_000,
  },
  move: {
    setupCommand: '',
    testCommand: 'aptos move compile --dev',
    timeoutMs: 300_000,
  },
  // Gen 11: agent-runtime bundles. The artifact is a system-prompt + templates
  // tree, not buildable code. The "build" gate is a structural check via
  // scripts/agent-runtime-bundle-check.ts that asserts:
  //   - system-prompt.md has valid YAML frontmatter
  //   - templates/index.json entries all resolve to files
  //   - wrangler.toml cron exprs are syntactically valid + ≤60×/hour
  //   - no symlinks pointing outside the bundle dir
  //   - no >10MB files (anti-bomb)
  // The script exits 1 on bundle defect, 2 on its own crash (so the harness
  // can distinguish "checker broke" from "bundle broke").
  // Verified by tests/agent-runtime-bundle-check.test.ts.
  markdown: {
    setupCommand: '',
    testCommand: 'tsx scripts/agent-runtime-bundle-check.ts .',
    timeoutMs: 30_000,
  },
}

/**
 * Build the harness config for a family based on its taxonomy.language.
 * The resolved setup/test commands run inside the composed tempdir, so
 * the agent-eval SandboxHarness can subprocess-invoke them.
 *
 * Throws on unknown language — the previous fallback (`testCommand:
 * 'true'`) silent-passed any family whose language wasn't in the
 * dispatch, which is the muffled-gate shape Gen 9 closes. Callers
 * that want to tolerate unknown languages must handle the throw
 * explicitly.
 */
export function makeHarnessConfig(components: ResolvedComponents): HarnessConfig {
  const language = components.family.taxonomy?.language ?? 'unknown'
  const config = HARNESS_CONFIGS[language]
  if (!config) {
    throw new Error(
      `makeHarnessConfig: unsupported taxonomy.language '${language}'. ` +
        `Add it to HARNESS_CONFIGS in src/eval/scaffold-bridge.ts with a ` +
        `strict (fail-loud) testCommand before composing a scaffold for it.`,
    )
  }
  return config
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
    [
      scaffoldDir,
      '-type',
      'f',
      '-not',
      '-path',
      '*/node_modules/*',
      '-not',
      '-path',
      '*/target/*',
      '-not',
      '-path',
      '*/.git/*',
      '-not',
      '-path',
      '*/dist/*',
    ],
    { encoding: 'utf8' },
  )
  if (res.status === 0) {
    for (const absPath of res.stdout.trim().split('\n').filter(Boolean)) {
      const relPath = absPath.startsWith(scaffoldDir + '/')
        ? absPath.slice(scaffoldDir.length + 1)
        : absPath
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
    case 'wasm':
      return 'application/wasm'
    case 'zkey':
      return 'application/octet-stream+zkey'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'woff':
    case 'woff2':
      return 'font/woff2'
    case 'pdf':
      return 'application/pdf'
    default:
      return undefined
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
    "3. **idiomatic**      — does the layout match the framework's canonical pattern? (risczero has methods/guest+host; SP1 has program/+script/)",
    '4. **production-ready** — are env vars documented? secrets NOT in source? build caching hints present?',
    "5. **over-scaffold**  — score 1 if ZERO layers are extraneous; lower if capabilities are attached that the prompt doesn't justify.",
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
function pickKeyFiles(snapshot: WorkspaceSnapshot): { path: string; content: string }[] {
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
  const out: { path: string; content: string }[] = []
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
  const res = spawnSync(
    'node',
    ['dist/cli.js', 'compose', '--spec', specPath, '--out', scaffoldDir, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
  if (res.status !== 0) {
    rmSync(scaffoldDir, { recursive: true, force: true })
    throw new Error(`compose failed (exit ${res.status}): ${res.stderr.slice(-500)}`)
  }

  const snapshot = snapshotScaffold(scaffoldDir)
  // cwd MUST be baked into the harness at preparation time. agent-eval's
  // SubprocessSandboxDriver.exec reads cwd from the per-call HarnessConfig,
  // NOT from the driver constructor (see agent-eval@0.7.0 — Gen 8b bug).
  // Returning the harness without cwd forces every caller to remember to
  // spread it in, and historical evidence says that fails — the runtime
  // eval path in scripts/agent-eval-scaffold.ts (pre-Round-0) had the
  // same construct-vs-call bug Gen 8b fixed in the promoters. Bake it in
  // here so the muffled gate is structurally impossible at this seam.
  const harness = { ...makeHarnessConfig(args.components), cwd: scaffoldDir }
  const assertions = manifestComplianceAssertions(args.components)

  return {
    scaffoldDir,
    harness,
    snapshot,
    assertions,
    cleanup: () => {
      try {
        rmSync(scaffoldDir, { recursive: true, force: true })
      } catch {
        /* noop */
      }
    },
  }
}

// Unused export to silence eslint no-unused-vars for types imported only
// for their TypeScript contract; consumers (judge wiring in the driver)
// pull these in via the re-export.
export type { HarnessConfig, JudgeFn, WorkspaceAssertion, WorkspaceSnapshot, SandboxDriver }

// ──────────────────────────────────────────────────────────────────
// Meta judge — calls the LLM via router.tangle.tools + parses verdict
// ──────────────────────────────────────────────────────────────────

export interface ScaffoldMetaVerdict {
  correctness: number
  completeness: number
  idiomatic: number
  productionReady: number
  overScaffold: number
  overall: number
  issues: { dimension: string; severity: 'low' | 'medium' | 'high'; description: string }[]
  verdict: 'pass' | 'fail' | 'borderline'
  rationale?: string
  /**
   * Token usage + model for cost tracking. Populated on LLM-scored
   * verdicts; absent when the compile-gate short-circuit fires (no LLM
   * spend). Consumers record into agent-eval's CostTracker so
   * cost-summary.json actually populates — pre-R4 the tracker was
   * created but never recorded to, producing an empty `{}` summary.
   */
  usage?: {
    inputTokens: number
    outputTokens: number
    model: string
  }
}

/**
 * Meta judge — Ax-structured scaffold quality assessment.
 *
 * Uses AxSignature + AxGen so the output schema is enforced at the library
 * layer, not via my hand-rolled regex-JSON-parse. Ax handles:
 *   - retries on malformed output
 *   - field-type coercion (number fields get numbers, not strings)
 *   - structured error reporting when the LLM refuses schema compliance
 *
 * Routes through `createLLM` which uses router.tangle.tools when
 * TANGLE_ROUTER_USER_KEY is set (preferred — centralized spend + governance),
 * else falls back to direct provider keys.
 */

// AxSignature DSL: '"<instruction>" input1:type, ... -> output1:type, ...'
// Each field can have a ':string' / ':number' / ':string[]' / ':boolean' type
// annotation. Ax coerces output into the declared type and retries if the
// model returns something uncoercible.
const META_JUDGE_SIGNATURE =
  '"Grade a freshly-composed project STARTER SCAFFOLD on five rubric dimensions (0..1 each, 1=perfect). ' +
  'CRITICAL CALIBRATION: a starter scaffold is a SKELETON the agent extends. ' +
  'Do NOT penalize for missing business logic, missing API client implementations, or missing domain-specific code. ' +
  "The scaffold's job is to give the agent a buildable floor — extension is the agent's job. " +
  'Judge ONLY what is given; do not hallucinate missing files. ' +
  'correctness = imports resolve, build recipe plausible, no obvious taxonomy/implementation mismatches (e.g. frontend surface with Node HTTP server in main.ts). ' +
  'completeness = scaffold has the expected slot files for its (language, runtime, surface) — e.g. frontend TS needs package.json + vite.config + index.html + entrypoint + README. Does NOT require business-logic implementation. ' +
  "idiomatic = layout + configs + dep versions match the framework's current canonical pattern (e.g. vite+react with TS5, not jest+TS4). " +
  'productionReady = env vars documented via .env.example or README Environment section, no secrets in source, scripts are the conventional ones for the runtime. ' +
  'overScaffold = 1 if zero extraneous dependencies or capabilities beyond what the surface justifies. ' +
  'overall = weighted aggregate; a SKELETON-COMPLETE scaffold with no taxonomy mismatches should score ≥ 0.8 and verdict=pass. ' +
  'verdict = pass | fail | borderline. issues = concrete defects ONLY (not missing business logic)." ' +
  'userPrompt:string, family:string, layers:string, fileList:string, keyFiles:string -> ' +
  'correctness:number, completeness:number, idiomatic:number, productionReady:number, overScaffold:number, ' +
  'overall:number, verdict:string, issues:string[], rationale:string'

export async function invokeMetaJudge(args: {
  userPrompt: string
  composedSpec: ComposeSpec
  snapshot: WorkspaceSnapshot
  /**
   * Optional outcome of the upstream build/typecheck phase. When present and
   * `passed === false`, the judge short-circuits to verdict='fail' WITHOUT
   * spending an LLM call — the scaffold cannot be useful if it doesn't
   * compile, regardless of how the rubric scores its layout. Carries the
   * failing phase + stderr tail into the issues array so reviewers see the
   * concrete failure (e.g. "typecheck: TS2339: createRoot does not exist").
   *
   * Gen 8 closure: PR #51 shipped 3 bugs (kyc-onboarding .ts JSX,
   * fraud-ops/polymarket React 17 imports) that all passed the existing
   * fidelity judge at 0.82-0.85 because the LLM judge cannot reliably
   * detect compile-time defects from text. The build gate that should
   * have caught them was muffled by `|| true`. This parameter lets the
   * judge hard-gate on compile success when the caller already ran the
   * build (the promoter does), without re-running the build itself.
   */
  buildOutcome?: { passed: boolean; phase?: string; stderr?: string; stdout?: string }
}): Promise<ScaffoldMetaVerdict> {
  // Compile-gate short-circuit. If the caller already ran the build and it
  // failed, return fail immediately. Saves the LLM call AND closes the
  // Goodhart loop where fidelity passes scaffolds the build would reject.
  if (args.buildOutcome?.passed === false) {
    const phase = args.buildOutcome.phase ?? 'build'
    const stderrTail = (args.buildOutcome.stderr ?? args.buildOutcome.stdout ?? '').slice(-500)
    return {
      correctness: 0,
      completeness: 0,
      idiomatic: 0,
      productionReady: 0,
      overScaffold: 0,
      overall: 0,
      issues: [
        {
          dimension: 'correctness',
          severity: 'high',
          description: `${phase} failed: ${stderrTail.replace(/\s+/g, ' ').trim().slice(0, 400)}`,
        },
      ],
      verdict: 'fail',
      rationale: `Build/typecheck failed at ${phase} — scaffold cannot run. LLM scoring skipped (compile-gate).`,
    }
  }
  const { createLLM } = await import('../lib/llm.js')
  const { ax } = await import('@ax-llm/ax')
  const { estimateTokens } = await import('@tangle-network/agent-eval')
  // Don't pin a router-specific model slug like "anthropic/claude-sonnet-4-6" —
  // it 404s on non-router providers in the fallback chain. createLLM() picks
  // each provider's default (Claude Haiku on Anthropic, Llama 3.3 on Together,
  // gpt-4o-mini on OpenAI, Haiku via router when the router key is present).
  // Any of these are capable enough to run a 5-dimensional rubric judge.
  const llm = createLLM()

  const judge = ax(META_JUDGE_SIGNATURE)
  const paths = Object.keys(args.snapshot.files).sort()
  const fileList =
    paths.slice(0, 80).join('\n') + (paths.length > 80 ? `\n[+${paths.length - 80} more]` : '')
  const keyFiles = renderKeyFilesForSignature(args.snapshot)

  const raw = (await judge.forward(
    llm,
    {
      userPrompt: args.userPrompt,
      family: args.composedSpec.family ?? 'unknown',
      layers: (args.composedSpec.layers ?? []).join(', ') || '(none)',
      fileList,
      keyFiles,
    },
    { stream: false },
  )) as {
    correctness?: number
    completeness?: number
    idiomatic?: number
    productionReady?: number
    overScaffold?: number
    overall?: number
    verdict?: string
    issues?: unknown
    rationale?: string
  }

  const num = (v: unknown, fallback = 0): number => {
    if (typeof v !== 'number' || Number.isNaN(v)) return fallback
    if (v > 1 && v <= 10) return v / 10 // defensive: tolerate 0-10 scale drift
    return Math.max(0, Math.min(1, v))
  }
  const issues = normalizeIssues(raw.issues)
  const correctness = num(raw.correctness)
  const completeness = num(raw.completeness)
  const idiomatic = num(raw.idiomatic)
  const productionReady = num(raw.productionReady)
  const overScaffold = num(raw.overScaffold, 1)
  const overallFallback =
    correctness * 0.3 +
    completeness * 0.3 +
    idiomatic * 0.2 +
    productionReady * 0.1 +
    overScaffold * 0.1
  const verdict: ScaffoldMetaVerdict['verdict'] =
    raw.verdict === 'pass' || raw.verdict === 'fail' || raw.verdict === 'borderline'
      ? raw.verdict
      : 'borderline'

  // Estimate token usage for cost tracking. AxGen.forward doesn't surface
  // provider usage stats in a stable shape across backends (router vs
  // Anthropic vs Together vs OpenAI), so estimate from the rendered
  // prompt + output text via agent-eval's char-based heuristic. Under-
  // estimates for structured-output heavy responses by <15%, good enough
  // for scorecard-level cost visibility. Replace with live usage if ax
  // exposes it via the AxAIService in a later version.
  const promptText = `${META_JUDGE_SIGNATURE}\n${args.userPrompt}\n${args.composedSpec.family ?? ''}\n${(args.composedSpec.layers ?? []).join(',')}\n${fileList}\n${keyFiles}`
  const outputText = JSON.stringify(raw)
  const usage = {
    inputTokens: estimateTokens(promptText),
    outputTokens: estimateTokens(outputText),
    // createLLM's model is provider-picked — record what the signature
    // most-closely corresponds to in MODEL_PRICING. Override in future
    // if createLLM exposes the resolved model name.
    model: 'claude-sonnet-4-20250514',
  }

  return {
    correctness,
    completeness,
    idiomatic,
    productionReady,
    overScaffold,
    overall: num(raw.overall, overallFallback),
    issues,
    verdict,
    rationale: raw.rationale,
    usage,
  }
}

// ──────────────────────────────────────────────────────────────────
// Judge fleet — orthogonal mechanical validation
// ──────────────────────────────────────────────────────────────────

/**
 * Verdict shape from a fleet of mechanical judges (compiler, test,
 * linter, security). Each judge runs the appropriate sandbox command
 * and emits a per-judge pass/fail. `unanimousPass` requires ALL judges
 * to pass; this is the new bar for "scaffold survived orthogonal
 * validation" and is harder to Goodhart than a single LLM judge's
 * aggregated overall score.
 *
 * Gen 10: this complements `invokeMetaJudge`, doesn't replace it. The
 * fleet covers mechanical correctness; the meta judge covers subjective
 * dimensions (idiomatic, productionReady) that mechanical gates can't
 * see. Consumers should run both and combine.
 */
export interface FleetVerdict {
  unanimousPass: boolean
  byJudge: {
    id: string
    kind: 'compiler' | 'test' | 'linter' | 'security'
    passed: boolean
    score: number
    summary: string
    durationMs: number
  }[]
  /** Mean of per-judge scores. 1.0 only when all pass. */
  overall: number
  /** Total wall-time across the fleet (parallel; max of per-judge wallMs). */
  wallMs: number
}

/**
 * Per-language fleet config table. Each language maps to a set of
 * sandbox commands the four mechanical judges will run. New languages
 * must be added here; absent languages skip the fleet (return
 * empty-pass) since we have no defensible commands to run.
 *
 * Why these specific commands:
 *   compiler: same testCommand from HARNESS_CONFIGS — it's the
 *     authoritative typecheck. Reusing keeps fleet aligned with the
 *     existing build gate.
 *   test:     family-canonical test runner if the language convention
 *     has one (vitest for TS, pytest for Python, cargo test for Rust).
 *     For families that ship no test fixtures, test judge is a no-op
 *     pass — this is honest (we have nothing to validate against)
 *     rather than fabricating green.
 *   linter:   forge-lint for solidity (Gen R1 cluster-fix), eslint for
 *     TS where configured, ruff for Python. No command = honest skip.
 *   security: a deps-vuln scan via `pnpm audit --audit-level high` for
 *     pnpm projects, `cargo audit` for Rust. Skip otherwise.
 */
function fleetCommandsForLanguage(
  language: string,
  surface: string,
): {
  compiler?: string
  test?: string
  linter?: string
  security?: string
} {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return {
        compiler: 'pnpm exec tsc --noEmit',
        // Gracefully skip when no test script defined; vitest --run hard
        // fails if vitest absent. The `pnpm test` form respects whatever
        // test command the family/package declares — including the
        // muffle-ok'd `echo no tests` patterns where applicable.
        test: 'pnpm test --run --passWithNoTests 2>&1 || true', // muffle-ok: test judge tolerates absent suites — it scores 1 only when tests exist AND pass; absent suites score honest-null
        linter: 'pnpm lint 2>&1 || true', // muffle-ok: linter score reflects exit 0/non-zero; absent lint script honest-skips
        security: 'pnpm audit --audit-level high --json 2>&1 || true', // muffle-ok: parsed by score function below; non-zero on real vulns
      }
    case 'rust':
      return {
        compiler: 'cargo check --workspace || cargo check',
        test: 'cargo test --workspace --no-run 2>&1 || true', // muffle-ok: compile-only test detection; test execution costly + flaky
      }
    case 'solidity':
      return {
        compiler: 'forge build',
        test: 'forge test --no-match-test "Skip" 2>&1 || true', // muffle-ok: many forge tests need fork-block setup; absent → score honest-null
        linter: 'forge lint 2>&1 || true', // muffle-ok: lint score reflects exit; absent foundry.toml [lint] section → honest-pass per Gen R1 fix
      }
    case 'markdown':
      // Gen 11 agent-runtime bundles. Mechanical judges (compiler/test/
      // linter/security) honest-skip — there's no code to typecheck or
      // unit-test. The `compiler` slot is repurposed to run the bundle-
      // check structural validator (yaml frontmatter, cron syntax,
      // template index resolution, anti-bomb checks). Future judges
      // (promptCoherence, templateCoverage, triggerSafety) plug in via
      // a separate path — see Gen 11 spec § "5 judges in agent-eval".
      return {
        compiler: 'tsx scripts/agent-runtime-bundle-check.ts .',
      }
    default:
      return {}
  }
}

/**
 * Score a fleet judge result. SandboxJudgeResult.score from agent-eval
 * is testsPassed/testsTotal where parsers exist; we override for cases
 * where the raw exit-code semantics need interpretation (e.g. lint
 * exit-2 means warnings-only on some toolchains, exit-non-zero means
 * security findings on pnpm audit).
 */
function interpretFleetResult(
  kind: 'compiler' | 'test' | 'linter' | 'security',
  exitCode: number,
  stdout: string,
): { passed: boolean; score: number; summary: string } {
  if (kind === 'security') {
    // pnpm audit exits non-zero on findings; parse JSON for high+ count.
    try {
      const j = JSON.parse(stdout || '{}')
      const high =
        (j.metadata?.vulnerabilities?.high ?? 0) + (j.metadata?.vulnerabilities?.critical ?? 0)
      return {
        passed: high === 0,
        score: high === 0 ? 1 : 0,
        summary: high === 0 ? 'no high/critical vulns' : `${high} high+ vulns`,
      }
    } catch {
      return {
        passed: exitCode === 0,
        score: exitCode === 0 ? 1 : 0,
        summary: `audit exit=${exitCode}`,
      }
    }
  }
  return {
    passed: exitCode === 0,
    score: exitCode === 0 ? 1 : 0,
    summary: exitCode === 0 ? `${kind} pass` : `${kind} exit=${exitCode}`,
  }
}

/**
 * Invoke the judge fleet against a composed scaffold's harness config.
 *
 * Returns a `FleetVerdict` aggregating per-judge results. Unanimous
 * pass is the new strictness bar — replaces "single LLM judge said
 * 0.85" as the validation gate.
 *
 * Reuses `BuilderSession`'s harness machinery for sandbox isolation;
 * each judge runs in its own subprocess with the language-specific
 * command. Skipped judges (no command for the language) score
 * honest-null and are excluded from `unanimousPass` math.
 */
export async function invokeJudgeFleet(args: {
  components: ResolvedComponents
  harness: HarnessConfig
}): Promise<FleetVerdict> {
  const { runJudgeFleet, compilerJudge, testJudge, linterJudge, securityJudge } =
    await import('@tangle-network/agent-eval')

  const language = args.components.family.taxonomy?.language ?? 'unknown'
  const surface = args.components.family.taxonomy?.surface ?? 'unknown'
  const cmds = fleetCommandsForLanguage(language, surface)

  const specs: ReturnType<typeof compilerJudge>[] = []
  if (cmds.compiler)
    specs.push(compilerJudge('fleet:compiler', { ...args.harness, testCommand: cmds.compiler }))
  if (cmds.test) specs.push(testJudge('fleet:test', { ...args.harness, testCommand: cmds.test }))
  if (cmds.linter)
    specs.push(linterJudge('fleet:linter', { ...args.harness, testCommand: cmds.linter }))
  if (cmds.security)
    specs.push(securityJudge('fleet:security', { ...args.harness, testCommand: cmds.security }))

  if (specs.length === 0) {
    return { unanimousPass: false, byJudge: [], overall: 0, wallMs: 0 }
  }

  const start = Date.now()
  const results = await runJudgeFleet(specs, { parallel: true })
  const wallMs = Date.now() - start

  const byJudge = results.map((r) => {
    const exit =
      r.detail?.test?.exitCode ?? r.detail?.run?.exitCode ?? r.detail?.setup?.exitCode ?? 1
    const stdout = r.detail?.test?.stdout ?? r.detail?.run?.stdout ?? ''
    const interp = interpretFleetResult(r.kind, exit, stdout)
    return {
      id: r.id,
      kind: r.kind,
      passed: interp.passed,
      score: interp.score,
      summary: interp.summary,
      durationMs: r.detail?.totalWallMs ?? 0,
    }
  })

  const unanimousPass = byJudge.length > 0 && byJudge.every((j) => j.passed)
  const overall = byJudge.length > 0 ? byJudge.reduce((a, j) => a + j.score, 0) / byJudge.length : 0

  return { unanimousPass, byJudge, overall, wallMs }
}

/**
 * Normalize the LLM's `issues` output into our typed shape. The AxSignature
 * declares issues:string[] (simple list of concerns). We then parse each
 * line for a "dimension: severity: description" pattern; if it doesn't
 * match, treat the whole line as a medium-severity unscoped issue. This
 * lets the judge use free-form language while giving the scorecard
 * consumer a structured shape.
 */
function normalizeIssues(raw: unknown): ScaffoldMetaVerdict['issues'] {
  if (!Array.isArray(raw)) return []
  const out: ScaffoldMetaVerdict['issues'] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const m = /^\s*(\w[\w-]*)\s*:\s*(low|medium|high)\s*:\s*(.+)$/i.exec(item)
      if (m) {
        out.push({
          dimension: m[1],
          severity: m[2].toLowerCase() as 'low' | 'medium' | 'high',
          description: m[3].trim(),
        })
      } else {
        out.push({ dimension: 'general', severity: 'medium', description: item.trim() })
      }
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const sev = o.severity === 'low' || o.severity === 'high' ? o.severity : 'medium'
      out.push({
        dimension: typeof o.dimension === 'string' ? o.dimension : 'general',
        severity: sev,
        description: typeof o.description === 'string' ? o.description : JSON.stringify(o),
      })
    }
  }
  return out
}

function renderKeyFilesForSignature(snapshot: WorkspaceSnapshot): string {
  const keyFiles = pickKeyFiles(snapshot)
  const PROMPT_FILE_CAP = 4000
  return keyFiles
    .map((f) => {
      const truncated = f.content.length > PROMPT_FILE_CAP
      const body = truncated
        ? `${f.content.slice(0, PROMPT_FILE_CAP)}\n[... ${f.content.length - PROMPT_FILE_CAP} more chars truncated for prompt — full content is in the snapshot ...]`
        : f.content
      return `### ${f.path}${truncated ? ' (truncated for prompt)' : ''}\n${body}`
    })
    .join('\n\n---\n\n')
}
