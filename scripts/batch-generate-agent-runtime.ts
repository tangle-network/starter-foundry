#!/usr/bin/env tsx
// batch-generate-agent-runtime — generate agent-runtime bundles from
// registry/seed-list-agent-runtime.json via TCloud's chat() endpoint.
//
// One pass per seed entry: chat → JSON.parse → write files → validate.
// Failures are reported; the operator decides what to promote.
//
// Usage:
//   TCLOUD_API_KEY=sk-tan-... tsx scripts/batch-generate-agent-runtime.ts \
//     --tranche 3 [--limit N] [--retry-once]
//
// Output: .evolve/family-proposals/<id>/{manifest.json, files/...}
//         .evolve/batch-generate-agent-runtime/<ts>/report.json

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TCloud } from '@tangle-network/tcloud'

import { validateComposedDir } from '../src/lib/validate.js'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SEED_LIST = join(REPO, 'registry/seed-list-agent-runtime.json')
const FAMILIES_DIR = join(REPO, 'registry/families')
const PROPOSALS_DIR = join(REPO, '.evolve/family-proposals')
const MODEL = process.env.SF_TCLOUD_MODEL ?? 'claude-haiku-4-5-20251001'

interface SeedEntry {
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

interface Envelope {
  manifest: { validationChecks?: unknown[] } & Record<string, unknown>
  files: { path: string; body: string }[]
}

interface EntryResult {
  familyId: string
  ok: boolean
  error?: string
  iterations: number
  durationMs: number
  failures?: { type: string; path?: string; error?: string }[]
}

function parseArgs() {
  const argv = process.argv.slice(2)
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    tranche: get('--tranche') ? Number(get('--tranche')) : undefined,
    limit: get('--limit') ? Number(get('--limit')) : undefined,
    retryOnce: argv.includes('--retry-once'),
  }
}

function buildPrompt(entry: SeedEntry, peers: string): { system: string; user: string } {
  const system = [
    'You author one agent-runtime bundle per request and return ONLY a JSON envelope (no prose, no markdown fences).',
    '',
    'Schema:',
    '{ "manifest": <full registry/families/<id>/manifest.json>,',
    '  "files":    [{ "path": "...", "body": "..." }, ...] }',
    '',
    'Hard rules:',
    '- Templates must be real methodology — never stubs or "TODO".',
    '- system-prompt.md frontmatter must include name, role, domain, allowedDomains, allowedEnv, version.',
    '- manifest.validationChecks must include file-exists for each emitted file + prompt-frontmatter-valid + template-index-valid (+ cron-syntax-valid only if a cron is set).',
    '- tieredKeywords must include both hyphenated and space-separated variants of each keyword.',
    '- Match the peer-bundle shapes EXACTLY for taxonomy / includes / defaults.',
  ].join('\n')

  const user = [
    `BUNDLE: ${entry.familyId}`,
    `ROLE: ${entry.role}`,
    `DOMAIN: ${entry.domain}`,
    `STAKES: ${entry.stakes}${entry.disclaimerRequired ? ' (DISCLAIMER REQUIRED — emit non-licensed/non-fiduciary language + :::escalation block)' : ''}`,
    `LAYERS: ${entry.suggestedLayers.join(', ')}`,
    `TIER1: ${entry.tier1Keywords.join(', ')}`,
    entry.tier2Keywords?.length ? `TIER2: ${entry.tier2Keywords.join(', ')}` : '',
    entry.archetypes?.length ? `ARCHETYPES: ${entry.archetypes.join(', ')}` : '',
    entry.templates?.length
      ? `TEMPLATES (real methodology, not stubs): ${entry.templates.join(', ')}`
      : '',
    `CRON: ${entry.cron ?? 'none — omit [triggers] block from wrangler.toml AND omit cron-syntax-valid from validationChecks'}`,
    '',
    'PEER BUNDLES (pattern-match these EXACTLY):',
    peers,
  ]
    .filter(Boolean)
    .join('\n')

  return { system, user }
}

function pickPeers(excludeId: string, n: number): string {
  const peers = readdirSync(FAMILIES_DIR)
    .filter((d) => d.startsWith('agent-runtime-') && d !== excludeId)
    .sort()
    .slice(0, n)
  return peers
    .map((p) => {
      const sections: string[] = [`### ${p}`]
      for (const f of ['manifest.json', 'files/system-prompt.md', 'files/templates/index.json']) {
        const path = join(FAMILIES_DIR, p, f)
        if (existsSync(path)) sections.push(`${f}:\n${readFileSync(path, 'utf8')}`)
      }
      return sections.join('\n\n')
    })
    .join('\n\n────────────\n\n')
}

async function generate(
  client: TCloud,
  entry: SeedEntry,
  retryOnce: boolean,
): Promise<EntryResult> {
  const t0 = Date.now()
  const { system, user } = buildPrompt(entry, pickPeers(entry.familyId, 3))
  const proposalDir = join(PROPOSALS_DIR, entry.familyId)
  mkdirSync(join(proposalDir, 'files'), { recursive: true })

  const attempts = retryOnce ? 2 : 1
  let lastErr = ''

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const completion = await client.chat({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        model: MODEL,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
      })
      const text = completion.choices?.[0]?.message?.content ?? ''
      const env = JSON.parse(text) as Envelope
      if (!env.manifest || !Array.isArray(env.files)) {
        throw new Error('envelope missing manifest or files[]')
      }

      writeFileSync(
        join(proposalDir, 'manifest.json'),
        JSON.stringify(env.manifest, null, 2) + '\n',
      )
      for (const f of env.files) {
        const abs = join(proposalDir, 'files', f.path)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, f.body)
      }

      const checks = env.manifest.validationChecks ?? []
      const validation = await validateComposedDir({
        composedDir: join(proposalDir, 'files'),
        checks: checks as Parameters<typeof validateComposedDir>[0]['checks'],
      })

      if (validation.ok && validation.checks.length > 0) {
        return {
          familyId: entry.familyId,
          ok: true,
          iterations: attempt,
          durationMs: Date.now() - t0,
        }
      }
      lastErr =
        validation.checks.length === 0
          ? 'manifest declared no validationChecks'
          : validation.checks
              .filter((c) => !c.ok)
              .map(
                (c) =>
                  `${c.check.type}${'path' in c.check && c.check.path ? ' ' + c.check.path : ''}`,
              )
              .join('; ')
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
    }
  }

  return {
    familyId: entry.familyId,
    ok: false,
    error: lastErr,
    iterations: attempts,
    durationMs: Date.now() - t0,
  }
}

async function main() {
  const opts = parseArgs()
  const apiKey = process.env.TCLOUD_API_KEY
  if (!apiKey) {
    console.error('TCLOUD_API_KEY required')
    process.exit(2)
  }

  const seedList = JSON.parse(readFileSync(SEED_LIST, 'utf8')) as { entries: SeedEntry[] }
  let entries = seedList.entries
  if (opts.tranche !== undefined) entries = entries.filter((e) => e.tranche === opts.tranche)
  entries = entries.filter((e) => !existsSync(join(FAMILIES_DIR, e.familyId)))
  // Resume-friendly: skip entries that already have a written proposal
  // manifest. The operator can `rm -rf .evolve/family-proposals/<id>`
  // to force regeneration.
  entries = entries.filter((e) => !existsSync(join(PROPOSALS_DIR, e.familyId, 'manifest.json')))
  if (opts.limit !== undefined) entries = entries.slice(0, opts.limit)

  console.log(`[batch] ${entries.length} entries · model=${MODEL} · retry-once=${opts.retryOnce}`)
  const client = new TCloud({ apiKey })
  const results: EntryResult[] = []

  for (const entry of entries) {
    process.stdout.write(`  ${entry.familyId} ... `)
    const r = await generate(client, entry, opts.retryOnce)
    results.push(r)
    if (r.ok) console.log(`PASS (${r.iterations} iter, ${r.durationMs}ms)`)
    else console.log(`FAIL (${r.iterations} iter): ${r.error?.slice(0, 100)}`)
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join(REPO, '.evolve/batch-generate-agent-runtime', ts)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'report.json'), JSON.stringify({ ts, opts, results }, null, 2))

  const passed = results.filter((r) => r.ok).length
  console.log(`\n[batch] ${passed}/${results.length} passed · report → ${outDir}/report.json`)
  if (passed < results.length) {
    console.log(`\nReview failures under .evolve/family-proposals/<id>/`)
    console.log(`Promote passes: pnpm promote:family-proposal --id <id>`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
