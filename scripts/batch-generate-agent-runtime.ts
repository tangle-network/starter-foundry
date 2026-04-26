#!/usr/bin/env tsx
// batch-generate-agent-runtime — runs the LLM family-proposer over the
// agent-runtime seed-list, emits proposals to .evolve/family-proposals/,
// composes each into a temp dir, and runs the 4-gate validator.
//
// What gets COMMITTED is still operator-decided — this script reports
// pass/fail per seed entry. The operator runs
// `pnpm promote:family-proposal --id <id>` for any proposal worth
// committing.
//
// Modes:
//   --tranche <n>   only propose entries with tranche === n
//   --limit <n>     cap to first N matching entries
//   --rlm           use propose-with-RLM (review loop) instead of single-shot
//   --max-shots <n> RLM shot budget (default 3)
//   --tcloud        use TCloud agentic dispatch (closed-loop with self-verification
//                   against the same gates the promoter runs). Requires
//                   TCLOUD_API_KEY in env. Highest-fidelity path; supersedes --rlm.
//   --tcloud-iterations <n>  per-entry iteration cap (default 8)
//   --tcloud-wall-sec <n>    per-entry wall-time cap in seconds (default 900)
//   --tcloud-usd <n>         per-entry $ budget (default 2)
//   --dry-run       skip LLM call; emit deterministic skeleton (TODO stubs)
//   --skip-existing skip any seed whose familyId already exists in registry/
//                   (default: true)
//   --include-existing  override skip-existing
//
// Output: .evolve/batch-generate-agent-runtime/<ts>/report.json

import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TCloud } from '@tangle-network/tcloud'

import { composeStarter } from '../src/lib/compose.js'
import { validateComposedDir } from '../src/lib/validate.js'
import {
  proposeFamily,
  proposeFamilyWithRLMToDisk,
} from '../src/training/family_proposer/propose.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SEED_LIST = join(REPO, 'registry/seed-list-agent-runtime.json')
const FAMILIES_DIR = join(REPO, 'registry/families')

interface SeedEntry {
  id: number
  familyId: string
  role: string
  domain: string
  axis: string
  stakes: string
  disclaimerRequired?: boolean
  suggestedLayers: string[]
  tier1Keywords: string[]
  tier2Keywords?: string[]
  archetypes?: string[]
  templates?: string[]
  cron?: string | null
  tranche: number
}

interface SeedList {
  version: string
  description: string
  entries: SeedEntry[]
}

interface PerEntryResult {
  familyId: string
  proposalDir?: string
  proposalMode?: 'llm' | 'llm-rlm' | 'deterministic' | 'tcloud-agent'
  composedDir?: string
  composeOk: boolean
  composeError?: string
  validateOk: boolean
  validateChecks?: { ok: boolean; check: unknown; error?: string }[]
  durationMs: number
  promotedToRegistry: boolean
  tcloudVerdict?: { verdict: string; iterations: number; wallMs: number; usd?: number }
  tcloudCriteria?: { iteration: number; name: string; ok: boolean; reason?: string }[]
}

function parseArgs(): {
  tranche?: number
  limit?: number
  rlm: boolean
  maxShots: number
  tcloud: boolean
  tcloudIterations: number
  tcloudWallSec: number
  tcloudUsd: number
  dryRun: boolean
  skipExisting: boolean
} {
  const argv = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    tranche: get('--tranche') ? Number(get('--tranche')) : undefined,
    limit: get('--limit') ? Number(get('--limit')) : undefined,
    rlm: argv.includes('--rlm'),
    maxShots: Number(get('--max-shots') ?? '3') || 3,
    tcloud: argv.includes('--tcloud'),
    tcloudIterations: Number(get('--tcloud-iterations') ?? '8') || 8,
    tcloudWallSec: Number(get('--tcloud-wall-sec') ?? '900') || 900,
    tcloudUsd: Number(get('--tcloud-usd') ?? '2') || 2,
    dryRun: argv.includes('--dry-run'),
    skipExisting: !argv.includes('--include-existing'),
  }
}

function buildDescription(entry: SeedEntry): string {
  const stakesNote = entry.disclaimerRequired
    ? ' This is a high-stakes regulated domain — the bundle MUST include a non-fiduciary / non-licensed disclaimer in the system prompt and emit a :::escalation block on any binding-decision moment.'
    : ''
  return `Agent-runtime bundle for a ${entry.role} (domain: ${entry.domain}, axis: ${entry.axis}). The bundle ships a Cloudflare-Worker-style markdown agent with system-prompt.md + templates/index.json + at least 3 methodology templates + wrangler.toml${entry.cron ? ` with a ${entry.cron} cron trigger` : ''}. Suggested layers: ${entry.suggestedLayers.join(', ')}. Routing keywords: tier1 = ${entry.tier1Keywords.join(', ')}.${stakesNote}`
}

function buildProductCues(entry: SeedEntry): string[] {
  const cues: string[] = []
  cues.push(`role: ${entry.role}`)
  cues.push(`domain: ${entry.domain}`)
  if (entry.templates && entry.templates.length > 0) {
    cues.push(`templates required (each one a real methodology doc, NOT a stub): ${entry.templates.join(', ')}`)
  }
  if (entry.disclaimerRequired) {
    cues.push('disclaimer required — include not-licensed / non-fiduciary / not-a-lawyer language in system-prompt frontmatter and body')
  }
  cues.push(`tier1 routing keywords: ${entry.tier1Keywords.join(', ')}`)
  if (entry.archetypes && entry.archetypes.length > 0) {
    cues.push(`archetypes: ${entry.archetypes.join(', ')}`)
  }
  cues.push('manifest validationChecks MUST include: file-exists for system-prompt.md, file-exists for templates/index.json, file-exists for wrangler.toml, prompt-frontmatter-valid, template-index-valid, cron-syntax-valid')
  return cues
}

async function processEntry(
  entry: SeedEntry,
  opts: ReturnType<typeof parseArgs>,
): Promise<PerEntryResult> {
  const startedAt = performance.now()
  const result: PerEntryResult = {
    familyId: entry.familyId,
    composeOk: false,
    validateOk: false,
    durationMs: 0,
    promotedToRegistry: false,
  }

  try {
    const proposeInput = {
      id: entry.familyId,
      description: buildDescription(entry),
      taxonomy: {
        language: 'markdown',
        runtime: 'cloudflare-worker',
        surface: 'agent-runtime',
      },
      productCues: buildProductCues(entry),
    }

    let proposal
    if (opts.tcloud) {
      // TCloud agentic dispatch: the agent self-iterates against criteria
      // (schema-valid, declared-dep-used, optional scaffold-runs) until
      // verdict, with per-entry budget caps. Output lands in
      // .evolve/family-proposals/<id>/ via the agent's workspaceDir.
      proposal = await runTcloudAgent(entry, proposeInput, opts, result)
      if (!proposal) return result
    } else if (opts.dryRun) {
      proposal = await proposeFamily({ ...proposeInput })
    } else if (opts.rlm) {
      proposal = await proposeFamilyWithRLMToDisk(proposeInput, { maxShots: opts.maxShots })
    } else {
      proposal = await proposeFamily(proposeInput)
    }

    result.proposalDir = proposal.proposalDir
    if (opts.tcloud) {
      result.proposalMode = 'tcloud-agent'
    } else if (proposal.mode === 'llm') {
      result.proposalMode = 'llm'
    } else if (proposal.mode === 'deterministic') {
      result.proposalMode = 'deterministic'
    } else {
      result.proposalMode = 'llm-rlm'
    }

    // Compose proposal into temp dir for validation. Note: this composes
    // FROM the proposal directory, not from registry/. We temporarily
    // shim by symlinking proposal → a synthetic registry entry would be
    // nicer, but for first-pass validation we read the manifest directly
    // and run the validators against the proposal's own files/ directory
    // as if it were a composed dir.
    const tmp = mkdtempSync(join(tmpdir(), `batch-agent-runtime-${entry.familyId}-`))
    try {
      // Copy proposal's files/ into tmp as a "composed" dir.
      const proposalFilesDir = join(proposal.proposalDir, 'files')
      if (!existsSync(proposalFilesDir)) {
        result.composeError = 'proposal has no files/ directory — proposer emitted manifest only'
        return result
      }
      // Compose by deep-copy.
      copyTree(proposalFilesDir, tmp)
      result.composedDir = tmp
      result.composeOk = true

      // Run the manifest's validationChecks against the composed dir.
      const manifest = proposal.manifest as { validationChecks?: unknown }
      const checks = (manifest.validationChecks as Array<unknown> | undefined) ?? []
      if (checks.length === 0) {
        result.validateOk = false
        result.composeError = 'manifest has no validationChecks — proposer emitted a skeleton, not a real bundle'
        return result
      }
      const validation = await validateComposedDir({
        composedDir: tmp,
        checks: checks as Parameters<typeof validateComposedDir>[0]['checks'],
      })
      result.validateOk = validation.ok
      result.validateChecks = validation.checks.map((c) => ({
        ok: c.ok,
        check: c.check,
        error: 'error' in c ? c.error : undefined,
      }))
    } finally {
      try {
        rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* best-effort */
      }
    }
  } catch (err) {
    result.composeError = err instanceof Error ? err.message : String(err)
  }

  result.durationMs = Math.round(performance.now() - startedAt)
  return result
}

// runTcloudAgent — direct TCloud SDK dispatch. Calls TCloud.chat() against
// router.tangle.tools per iteration, asks the model to emit a JSON envelope
// describing every file in the bundle, writes them to disk, runs the
// validator, and re-prompts on failure. No agent runtime, no tool calls —
// the loop is here in this script. This is what "uses tcloud SDK" actually
// means: structured chat completions through the Tangle router with our
// own iteration / verification / re-prompt cycle around them.
interface AgentBundleEnvelope {
  manifest: Record<string, unknown>
  files: { path: string; body: string }[]
  reasoning?: string
}

async function runTcloudAgent(
  entry: SeedEntry,
  proposeInput: { id: string; description: string; taxonomy: { language: string; runtime: string; surface: string }; productCues: string[] },
  opts: ReturnType<typeof parseArgs>,
  result: PerEntryResult,
): Promise<{ proposalDir: string; manifest: unknown; mode: 'tcloud-direct' } | null> {
  const apiKey = process.env.TCLOUD_API_KEY
  if (!apiKey) {
    result.composeError = 'TCLOUD_API_KEY missing — set it in env to use --tcloud mode'
    return null
  }

  const proposalDir = join(REPO, '.evolve/family-proposals', entry.familyId)
  mkdirSync(proposalDir, { recursive: true })
  mkdirSync(join(proposalDir, 'files'), { recursive: true })

  // Pull 3 peer bundles as concrete examples — gold-standard manifest +
  // system-prompt shapes the model can pattern-match against.
  const peerSnippets = pickPeerBundles(entry.familyId, 3)

  const systemPrompt = [
    'You are a family-scaffold author for starter-foundry. Your job: write one complete agent-runtime bundle as a single JSON envelope.',
    '',
    'Output schema (return ONLY this JSON, no prose, no markdown fences):',
    '{',
    '  "manifest": { /* full registry/families/<id>/manifest.json content */ },',
    '  "files": [',
    '    { "path": "system-prompt.md", "body": "..." },',
    '    { "path": "templates/index.json", "body": "..." },',
    '    { "path": "templates/<methodology>.md", "body": "..." },',
    '    { "path": "wrangler.toml", "body": "..." },',
    '    { "path": "README.md", "body": "..." }',
    '  ],',
    '  "reasoning": "1-3 sentence summary of pattern choices made"',
    '}',
    '',
    'Hard rules:',
    '- Templates must be real methodology, never stubs or "TODO"',
    '- Frontmatter on system-prompt.md must include name, role, domain, allowedDomains, allowedEnv, version',
    '- Manifest validationChecks must include file-exists for each file you emit + prompt-frontmatter-valid + template-index-valid + (cron-syntax-valid if cron present)',
    '- tieredKeywords must include space-separated variants (e.g. "fitness-coach" AND "fitness coach")',
    '- Match the peer-bundle shapes EXACTLY for taxonomy, includes, defaults structure',
  ].join('\n')

  const userPrompt = [
    `BUNDLE TO AUTHOR: ${entry.familyId}`,
    `ROLE: ${entry.role}`,
    `DOMAIN: ${entry.domain}`,
    `STAKES: ${entry.stakes}${entry.disclaimerRequired ? ' (DISCLAIMER REQUIRED — emit non-licensed/non-fiduciary language and :::escalation block)' : ''}`,
    `LAYERS TO INCLUDE: ${entry.suggestedLayers.join(', ')}`,
    `TIER1 KEYWORDS: ${entry.tier1Keywords.join(', ')}`,
    entry.tier2Keywords ? `TIER2 KEYWORDS: ${entry.tier2Keywords.join(', ')}` : '',
    entry.archetypes ? `ARCHETYPES: ${entry.archetypes.join(', ')}` : '',
    entry.templates ? `TEMPLATES (each with real methodology): ${entry.templates.join(', ')}` : '',
    `CRON: ${entry.cron ?? 'none — omit [triggers] block from wrangler.toml AND omit cron-syntax-valid from validationChecks'}`,
    '',
    'PEER BUNDLES (pattern-match these EXACTLY for shape):',
    peerSnippets,
  ]
    .filter(Boolean)
    .join('\n')

  const client = new TCloud({ apiKey })
  // Default to claude-haiku-4-5 — free tier on the Tangle router and the
  // smallest Anthropic model that handles structured-JSON output reliably.
  // Override via SF_TCLOUD_MODEL=anthropic/claude-sonnet-4-5 etc. when the
  // operator has paid credits.
  const model = process.env.SF_TCLOUD_MODEL ?? 'claude-haiku-4-5-20251001'
  const impactLog = join(REPO, '.evolve/generation-impact.jsonl')

  let lastError = ''
  const startedAt = Date.now()
  let totalUsd = 0
  const criteria: { iteration: number; name: string; ok: boolean; reason?: string }[] = []

  for (let iter = 1; iter <= opts.tcloudIterations; iter++) {
    if ((Date.now() - startedAt) / 1000 > opts.tcloudWallSec) {
      lastError = `wall-time budget exhausted (${opts.tcloudWallSec}s)`
      break
    }
    if (totalUsd > opts.tcloudUsd) {
      lastError = `usd budget exhausted ($${totalUsd.toFixed(2)} > $${opts.tcloudUsd})`
      break
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]
    if (lastError) {
      messages.push({
        role: 'user' as const,
        content: `Previous attempt failed validation: ${lastError}\nFix and re-emit the FULL JSON envelope.`,
      })
    }

    process.stdout.write(`\n  [${entry.familyId}] iter ${iter} (model=${model}) ... `)
    let envelope: AgentBundleEnvelope
    try {
      // responseFormat: { type: 'json_object' } is honored by every Tangle
      // router model that supports JSON mode upstream (claude-haiku, gpt-4o,
      // deepseek). Models that don't support it ignore the field; the
      // lenient parser handles both cases.
      const completion = await client.chat({
        messages,
        model,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
      })
      const text = completion.choices?.[0]?.message?.content ?? ''
      const usage = (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage
      // Rough cost approximation — Sonnet is ~$3/$15 per Mtok.
      const inT = usage?.prompt_tokens ?? 0
      const outT = usage?.completion_tokens ?? 0
      totalUsd += (inT * 3 + outT * 15) / 1_000_000
      envelope = parseEnvelope(text)
    } catch (err) {
      lastError = `chat call failed: ${err instanceof Error ? err.message : String(err)}`
      criteria.push({ iteration: iter, name: 'envelope-parse', ok: false, reason: lastError })
      logImpactEventLocal(impactLog, { familyId: entry.familyId, event: 'iteration', iteration: iter, ok: false, reason: lastError })
      console.log(`FAIL: ${lastError.slice(0, 80)}`)
      continue
    }

    // Write envelope to disk.
    writeFileSync(join(proposalDir, 'manifest.json'), JSON.stringify(envelope.manifest, null, 2) + '\n')
    for (const f of envelope.files) {
      const abs = join(proposalDir, 'files', f.path)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, f.body)
    }

    // Validate by composing files/ as a synthetic composed dir + running
    // the manifest's own validationChecks against it.
    const tmp = mkdtempSync(join(tmpdir(), `tcloud-validate-${entry.familyId}-`))
    try {
      copyTree(join(proposalDir, 'files'), tmp)
      const checks = (envelope.manifest.validationChecks as Array<unknown> | undefined) ?? []
      if (checks.length === 0) {
        lastError = 'manifest has no validationChecks'
      } else {
        const validation = await validateComposedDir({
          composedDir: tmp,
          checks: checks as Parameters<typeof validateComposedDir>[0]['checks'],
        })
        if (validation.ok) {
          criteria.push({ iteration: iter, name: 'all-gates', ok: true })
          logImpactEventLocal(impactLog, { familyId: entry.familyId, event: 'iteration', iteration: iter, ok: true })
          console.log(`PASS (totalUsd≈$${totalUsd.toFixed(3)})`)
          result.tcloudVerdict = {
            verdict: 'pass',
            iterations: iter,
            wallMs: Date.now() - startedAt,
            usd: totalUsd,
          }
          result.tcloudCriteria = criteria
          return { proposalDir, manifest: envelope.manifest, mode: 'tcloud-direct' }
        }
        lastError =
          'gate failures: ' +
          validation.checks
            .filter((c) => !c.ok)
            .map((c) => `${c.check.type}${('path' in c.check && c.check.path) ? ' ' + c.check.path : ''}${'error' in c ? ' (' + c.error + ')' : ''}`)
            .join('; ')
      }
      criteria.push({ iteration: iter, name: 'all-gates', ok: false, reason: lastError })
      logImpactEventLocal(impactLog, { familyId: entry.familyId, event: 'iteration', iteration: iter, ok: false, reason: lastError })
      console.log(`FAIL: ${lastError.slice(0, 80)}`)
    } finally {
      try {
        rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* best-effort */
      }
    }
  }

  result.tcloudVerdict = {
    verdict: 'exhausted',
    iterations: opts.tcloudIterations,
    wallMs: Date.now() - startedAt,
    usd: totalUsd,
  }
  result.tcloudCriteria = criteria
  result.composeError = `tcloud agent exhausted budget without passing gates. last error: ${lastError}`
  return null
}

function parseEnvelope(text: string): AgentBundleEnvelope {
  // Multi-strategy parser. Order matters: try the cheapest happy paths
  // first, fall back to brace-walking only when models output prose +
  // JSON blob. Every successful parse is validated against the envelope
  // contract (manifest object + files array). Reasoning is optional.
  const candidates = collectJsonCandidates(text)
  const errors: string[] = []
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        errors.push('not a JSON object')
        continue
      }
      if (!parsed.manifest || typeof parsed.manifest !== 'object') {
        errors.push('missing manifest')
        continue
      }
      if (!Array.isArray(parsed.files)) {
        errors.push('files is not an array')
        continue
      }
      // Validate file entries — tolerate missing body but reject missing path.
      const files = parsed.files
        .filter((f: unknown) => f && typeof f === 'object' && typeof (f as { path?: unknown }).path === 'string')
        .map((f: { path: string; body?: string; content?: string }) => ({
          path: f.path,
          body: typeof f.body === 'string' ? f.body : typeof f.content === 'string' ? f.content : '',
        }))
      if (files.length === 0) {
        errors.push('files array empty after shape filter')
        continue
      }
      return {
        manifest: parsed.manifest,
        files,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }
  throw new Error(`could not parse envelope (${candidates.length} candidates tried): ${errors.slice(0, 3).join('; ')}`)
}

function collectJsonCandidates(text: string): string[] {
  const out: string[] = []
  const trimmed = text.trim()
  if (!trimmed) return out

  // 1. Whole text as-is (works when responseFormat: json_object honored).
  out.push(trimmed)

  // 2. Fenced ```json blocks (and bare ```), in document order.
  const fenceRe = /```(?:json|jsonc)?\s*([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(trimmed)) !== null) {
    if (m[1]) out.push(m[1].trim())
  }

  // 3. Brace-walk: find balanced { ... } substrings starting at each '{'.
  // Bails after finding 3 to avoid pathological O(n²) on huge inputs.
  let found = 0
  for (let i = 0; i < trimmed.length && found < 3; i++) {
    if (trimmed[i] !== '{') continue
    const balanced = sliceBalanced(trimmed, i)
    if (balanced) {
      out.push(balanced)
      found++
      i += balanced.length - 1
    }
  }

  // Dedupe while preserving order.
  return [...new Set(out)]
}

function sliceBalanced(s: string, start: number): string | null {
  if (s[start] !== '{') return null
  let depth = 0
  let inStr = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inStr = !inStr
      continue
    }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function pickPeerBundles(excludeId: string, n: number): string {
  const peers = readdirSync(FAMILIES_DIR)
    .filter((d) => d.startsWith('agent-runtime-') && d !== excludeId)
    .sort()
    .slice(0, n)
  return peers
    .map((peer) => {
      const manifestPath = join(FAMILIES_DIR, peer, 'manifest.json')
      const promptPath = join(FAMILIES_DIR, peer, 'files/system-prompt.md')
      const indexPath = join(FAMILIES_DIR, peer, 'files/templates/index.json')
      const sections: string[] = [`### ${peer}`]
      if (existsSync(manifestPath)) sections.push('manifest.json:\n' + readFileSync(manifestPath, 'utf8'))
      if (existsSync(promptPath)) sections.push('system-prompt.md:\n' + readFileSync(promptPath, 'utf8'))
      if (existsSync(indexPath)) sections.push('templates/index.json:\n' + readFileSync(indexPath, 'utf8'))
      return sections.join('\n\n')
    })
    .join('\n\n────────────\n\n')
}

function logImpactEventLocal(path: string, entry: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true })
  const line = JSON.stringify({ ts: new Date().toISOString(), source: 'batch-generate-agent-runtime', ...entry }) + '\n'
  appendFileSync(path, line)
}

function copyTree(src: string, dst: string): void {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src)) {
    const s = join(src, entry)
    const d = join(dst, entry)
    if (statSync(s).isDirectory()) {
      mkdirSync(d, { recursive: true })
      copyTree(s, d)
    } else {
      copyFileSync(s, d)
    }
  }
}

async function main(): Promise<void> {
  const opts = parseArgs()
  const seedList = JSON.parse(readFileSync(SEED_LIST, 'utf8')) as SeedList
  let entries = seedList.entries
  if (opts.tranche !== undefined) {
    entries = entries.filter((e) => e.tranche === opts.tranche)
  }
  if (opts.skipExisting) {
    entries = entries.filter((e) => !existsSync(join(FAMILIES_DIR, e.familyId)))
  }
  if (opts.limit !== undefined) {
    entries = entries.slice(0, opts.limit)
  }

  console.log(`[batch-agent-runtime] processing ${entries.length} seed entries`)
  const modeLabel = opts.dryRun
    ? 'dry-run (deterministic)'
    : opts.tcloud
      ? `tcloud-agent (iter≤${opts.tcloudIterations}, wall≤${opts.tcloudWallSec}s, $≤${opts.tcloudUsd})`
      : opts.rlm
        ? `rlm (max-shots=${opts.maxShots})`
        : 'single-shot LLM'
  console.log(`[batch-agent-runtime] mode: ${modeLabel}`)
  if (opts.tcloud && !process.env.TCLOUD_API_KEY) {
    console.error('[batch-agent-runtime] FATAL: --tcloud requires TCLOUD_API_KEY in env')
    process.exit(2)
  }

  const results: PerEntryResult[] = []
  for (const entry of entries) {
    process.stdout.write(`  • ${entry.familyId} (tranche ${entry.tranche}) ... `)
    const result = await processEntry(entry, opts)
    results.push(result)
    if (result.validateOk) console.log(`PASS (${result.durationMs}ms, mode=${result.proposalMode})`)
    else if (result.composeOk) console.log(`COMPOSE-OK / VALIDATE-FAIL (${result.durationMs}ms)`)
    else console.log(`COMPOSE-FAIL: ${result.composeError ?? 'unknown'}`)
  }

  // Persist report.
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join(REPO, '.evolve/batch-generate-agent-runtime', ts)
  mkdirSync(outDir, { recursive: true })
  const report = {
    ts: new Date().toISOString(),
    opts,
    counts: {
      total: results.length,
      validateOk: results.filter((r) => r.validateOk).length,
      composeOnly: results.filter((r) => r.composeOk && !r.validateOk).length,
      composeFail: results.filter((r) => !r.composeOk).length,
    },
    results,
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log('')
  console.log(`[batch-agent-runtime] summary: ${report.counts.validateOk}/${report.counts.total} passed all gates`)
  console.log(`[batch-agent-runtime] report → ${outDir}/report.json`)
  console.log('')
  console.log('next steps:')
  console.log('  1. Review proposals under .evolve/family-proposals/<id>/')
  console.log('  2. For each PASS: pnpm promote:family-proposal --id <id>')
  console.log('  3. For each COMPOSE-OK / VALIDATE-FAIL: inspect validateChecks, hand-edit or rerun with --rlm or --tcloud')
  if (opts.tcloud) {
    console.log('')
    console.log('tcloud-agent runs:')
    console.log('  • Verdict per entry → .evolve/generation-impact.jsonl (event=verdict)')
    console.log('  • Per-iteration gate transcript → .evolve/generation-impact.jsonl (event=criterion.check)')
    console.log('  • Per-entry .tcloudVerdict + .tcloudCriteria in the report.json above')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
