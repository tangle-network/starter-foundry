#!/usr/bin/env tsx
// convert-to-markdown-only — migrate an agent-runtime bundle from the
// old shape (system-prompt.md + templates/ + wrangler.toml) to the new
// markdown-only shape (system-prompt.md + TOOLS.md + methodology/ + manifest)
// with agent-base:secure inherited.
//
// Mechanical transform; preserves the bundle's content. Hand polish for
// system-prompt ceremony stripping is a separate pass.
//
// Usage:
//   tsx scripts/convert-to-markdown-only.ts <bundle-dir>
//   tsx scripts/convert-to-markdown-only.ts --all-registry
//   tsx scripts/convert-to-markdown-only.ts --all-proposals

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FAMILIES_DIR = join(REPO, 'registry/families')
const PROPOSALS_DIR = join(REPO, '.evolve/family-proposals')

interface Manifest {
  id: string
  description?: string
  tags?: string[]
  taxonomy?: { language?: string; runtime?: string; surface?: string }
  includes?: string[]
  defaults?: Record<string, unknown> & {
    allowedDomains?: string[]
    allowedEnv?: string[]
    schedule?: unknown[]
    secrets?: string[]
    outboundDomains?: string[]
    declaredCapabilities?: string[]
  }
  files?: { source: string; target: string }[]
  validationChecks?: { type: string; path?: string }[]
  contextHints?: { commands?: string[]; entrypoints?: string[]; extensionPoints?: string[] }
  keywords?: string[]
  tieredKeywords?: Record<string, unknown>
}

interface ConvertResult {
  bundleDir: string
  ok: boolean
  changes: string[]
  error?: string
}

function extractCron(wranglerContent: string): { id: string; cron: string; capability: string }[] {
  const out: { id: string; cron: string; capability: string }[] = []
  const cronArrayMatch = /crons\s*=\s*\[([^\]]*)\]/.exec(wranglerContent)
  if (!cronArrayMatch?.[1]) return out
  const matches = [...cronArrayMatch[1].matchAll(/"([^"]+)"/g)]
  matches.forEach((m, i) => {
    out.push({
      id: `scheduled-${i + 1}`,
      cron: m[1]!,
      capability: 'scheduled-trigger',
    })
  })
  return out
}

function deriveScheduleFromManifestAndCron(manifest: Manifest, wranglerCron: ReturnType<typeof extractCron>) {
  // If manifest already has a schedule, leave it alone.
  if (Array.isArray(manifest.defaults?.schedule) && manifest.defaults!.schedule!.length > 0) {
    return manifest.defaults!.schedule as unknown[]
  }
  // Match schedule capability to a declared capability when there's exactly one.
  const declared = manifest.defaults?.declaredCapabilities ?? []
  const fallbackCap = declared.length > 0 ? declared[0]! : 'scheduled-trigger'
  return wranglerCron.map((c, i) => ({
    id: c.id,
    cron: c.cron,
    capability: declared.length > i ? declared[i]! : fallbackCap,
  }))
}

function inferToolsFromBundle(manifest: Manifest, bundleId: string): string {
  const role = manifest.description?.split('.')[0] ?? bundleId
  const declared = manifest.defaults?.declaredCapabilities ?? []
  const includes = manifest.includes ?? []
  const hasVoice = includes.some((i) => i.includes('phony-voice'))
  const hasResearch = includes.some((i) => i.includes('research-corpus'))

  const lines: string[] = [
    `# TOOLS — ${manifest.id}`,
    '',
    `The bundle inherits all primitives from \`agent-base:secure\`: \`secrets\`, \`workspace\`, \`webhook-in\`, \`webhook-out\`, \`schedule\`, \`identity\`, \`audit\`. Plus generic agent tools: \`Read\`, \`Write\`, \`Edit\`, \`Glob\`, \`Grep\`, \`Bash\`, \`WebFetch\`.`,
    '',
    'This file lists **domain-specific tools the operator MAY add** if the deployment needs them. Each entry is intent — not implementation. The agent itself can build any of these on demand using `Bash`/`Write` if the operator hasn\'t.',
    '',
  ]

  // Voice-first bundles get a voice section.
  if (hasVoice) {
    lines.push('## Voice mode (inherited from `agent-tools:phony-voice`)', '')
    lines.push('| Capability | Intent |', '|---|---|')
    lines.push('| `voice.stt(audioPath)` | Speech-to-text via `@ph0ny/sdk` |')
    lines.push('| `voice.tts(text)` | Text-to-speech via `@ph0ny/sdk` |', '')
  }

  // Research bundles get the research-corpus section.
  if (hasResearch) {
    lines.push('## Research corpus (inherited from `agent-tools:research-corpus`)', '')
    lines.push('| Capability | Intent |', '|---|---|')
    lines.push('| `corpus.arxiv(query)` | arXiv paper search |')
    lines.push('| `corpus.semanticScholar(query)` | Semantic Scholar |')
    lines.push('| `corpus.openalex(query)` | OpenAlex |')
    lines.push('| `corpus.crossref(query)` | Crossref DOI metadata |', '')
  }

  lines.push(`## Domain tools the operator may want`)
  lines.push('')
  lines.push('Stub list — replace with role-specific entries. Keep ≤10 domain tools per deployment; more is fragmentation. Each tool should be:')
  lines.push('- Single-purpose')
  lines.push('- JSON output')
  lines.push('- ≤100 LOC')
  lines.push('- Listed here when added')
  lines.push('')
  lines.push('| Tool | Intent | Notes |')
  lines.push('|---|---|---|')

  // Derive 2-4 stubs from declared capabilities.
  for (const cap of declared.slice(0, 4)) {
    lines.push(`| \`${cap.replace(/\s+/g, '-')}\` | Concrete tool implementing the \`${cap}\` capability | Operator implements when needed |`)
  }

  if (declared.length === 0) {
    lines.push(`| (define) | Add tools the ${role} role would actually use | Per-deployment; intent before implementation |`)
  }

  lines.push('')
  lines.push('## Build a new tool when you need it')
  lines.push('')
  lines.push('The agent\'s job includes building tools when the measurement doesn\'t exist. New tools should be small, JSON-output, single-purpose. Add an entry here via PR after shipping.')

  return lines.join('\n') + '\n'
}

function convertOne(bundleDir: string): ConvertResult {
  const result: ConvertResult = { bundleDir, ok: false, changes: [] }
  const manifestPath = join(bundleDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    result.error = `no manifest.json at ${bundleDir}`
    return result
  }

  let manifest: Manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  } catch (err) {
    result.error = `manifest parse: ${(err as Error).message}`
    return result
  }

  // Skip if already converted (already has agent-base:secure).
  if (manifest.includes?.includes('agent-base:secure')) {
    // Verify it has TOOLS.md and methodology/ — if missing, keep going to backfill.
    const filesDir = bundleDir.includes('/family-proposals/') ? join(bundleDir, 'files') : join(bundleDir, 'files')
    if (existsSync(join(filesDir, 'TOOLS.md')) && existsSync(join(filesDir, 'methodology'))) {
      result.ok = true
      result.changes.push('already-converted')
      return result
    }
  }

  const filesDir = join(bundleDir, 'files')
  if (!existsSync(filesDir)) {
    result.error = `no files/ directory`
    return result
  }

  // 1. Add agent-base:secure to includes.
  manifest.includes = manifest.includes ?? []
  if (!manifest.includes.includes('agent-base:tangle')) manifest.includes.unshift('agent-base:tangle')
  if (!manifest.includes.includes('agent-base:secure')) {
    const idx = manifest.includes.indexOf('agent-base:tangle')
    manifest.includes.splice(idx + 1, 0, 'agent-base:secure')
    result.changes.push('added agent-base:secure')
  }

  // 2. Migrate cron from wrangler.toml → manifest.defaults.schedule.
  const wranglerPath = join(filesDir, 'wrangler.toml')
  let wranglerCron: ReturnType<typeof extractCron> = []
  if (existsSync(wranglerPath)) {
    try {
      wranglerCron = extractCron(readFileSync(wranglerPath, 'utf8'))
    } catch {
      /* best-effort */
    }
  }
  manifest.defaults = manifest.defaults ?? {}
  const newSchedule = deriveScheduleFromManifestAndCron(manifest, wranglerCron)
  if (newSchedule.length > 0 && !Array.isArray(manifest.defaults.schedule)) {
    manifest.defaults.schedule = newSchedule
    result.changes.push(`migrated ${newSchedule.length} cron(s) to manifest.defaults.schedule`)
  }

  // 3. Move allowedDomains → outboundDomains; allowedEnv → secrets.
  if (Array.isArray(manifest.defaults.allowedDomains) && !Array.isArray(manifest.defaults.outboundDomains)) {
    manifest.defaults.outboundDomains = manifest.defaults.allowedDomains
    delete manifest.defaults.allowedDomains
    result.changes.push('renamed allowedDomains → outboundDomains')
  }
  if (Array.isArray(manifest.defaults.allowedEnv) && !Array.isArray(manifest.defaults.secrets)) {
    manifest.defaults.secrets = manifest.defaults.allowedEnv
    delete manifest.defaults.allowedEnv
    result.changes.push('renamed allowedEnv → secrets')
  }

  // 4. Rename templates/ → methodology/ in files dir + manifest.files entries.
  const templatesPath = join(filesDir, 'templates')
  const methodologyPath = join(filesDir, 'methodology')
  if (existsSync(templatesPath) && !existsSync(methodologyPath)) {
    renameSync(templatesPath, methodologyPath)
    result.changes.push('renamed templates/ → methodology/')
  }

  // 5. Update manifest.files entries to point at new locations.
  if (Array.isArray(manifest.files)) {
    manifest.files = manifest.files
      .filter((f) => !f.target.endsWith('wrangler.toml')) // drop wrangler entry
      .map((f) => ({
        source: f.source.replace('files/templates/', 'files/methodology/'),
        target: f.target.replace(/^templates\//, 'methodology/'),
      }))
    // Add TOOLS.md entry if not present.
    if (!manifest.files.some((f) => f.target === 'TOOLS.md')) {
      manifest.files.push({ source: 'files/TOOLS.md', target: 'TOOLS.md' })
      result.changes.push('added TOOLS.md to files[]')
    }
  }

  // 6. Drop wrangler.toml.
  if (existsSync(wranglerPath)) {
    rmSync(wranglerPath)
    result.changes.push('dropped wrangler.toml')
  }

  // 7. Update validationChecks: prompt-frontmatter-valid → agents-md-valid;
  //    template-index-valid → methodology-index-valid; cron-syntax-valid → schedule-valid.
  if (Array.isArray(manifest.validationChecks)) {
    manifest.validationChecks = manifest.validationChecks
      .filter((c) => c.path !== 'wrangler.toml' || c.type !== 'file-exists') // drop wrangler.toml file-exists
      .map((c) => {
        if (c.type === 'prompt-frontmatter-valid') return { type: 'agents-md-valid', path: c.path }
        if (c.type === 'template-index-valid') return { type: 'methodology-index-valid', path: c.path?.replace(/^templates\//, 'methodology/') }
        if (c.type === 'cron-syntax-valid') return { type: 'schedule-valid', path: 'manifest.json' }
        if (c.type === 'file-exists' && c.path?.startsWith('templates/')) {
          return { type: c.type, path: c.path.replace(/^templates\//, 'methodology/') }
        }
        return c
      })
    // Add file-exists for TOOLS.md if missing.
    if (!manifest.validationChecks.some((c) => c.path === 'TOOLS.md')) {
      manifest.validationChecks.push({ type: 'file-exists', path: 'TOOLS.md' })
    }
    result.changes.push('updated validationChecks for new validators')
  }

  // 8. Generate boilerplate TOOLS.md.
  const toolsPath = join(filesDir, 'TOOLS.md')
  if (!existsSync(toolsPath)) {
    writeFileSync(toolsPath, inferToolsFromBundle(manifest, manifest.id))
    result.changes.push('wrote TOOLS.md (boilerplate)')
  }

  // 9. Update methodology/index.json paths if needed (the rename handles
  //    the file move; the index entries should already use ./*.md relative
  //    paths that don't change).

  // 10. Update contextHints.entrypoints to system-prompt.md (preserved name).
  manifest.contextHints = manifest.contextHints ?? {}
  if (!manifest.contextHints.entrypoints?.length) {
    manifest.contextHints.entrypoints = ['system-prompt.md']
  }

  // Write manifest back.
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  result.ok = true
  return result
}

function listBundles(scope: 'registry' | 'proposals'): string[] {
  const root = scope === 'registry' ? FAMILIES_DIR : PROPOSALS_DIR
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((d) => d.startsWith('agent-runtime-'))
    .map((d) => join(root, d))
    .filter((p) => existsSync(join(p, 'manifest.json')))
}

function main(): void {
  const argv = process.argv.slice(2)
  const targets: string[] = []
  if (argv.includes('--all-registry')) targets.push(...listBundles('registry'))
  if (argv.includes('--all-proposals')) targets.push(...listBundles('proposals'))
  for (const arg of argv) {
    if (!arg.startsWith('--') && existsSync(arg)) targets.push(resolve(arg))
  }
  if (targets.length === 0) {
    console.error('usage: convert-to-markdown-only.ts <bundle-dir> | --all-registry | --all-proposals')
    process.exit(2)
  }

  console.log(`[convert] ${targets.length} bundles`)
  let ok = 0
  let fail = 0
  let already = 0
  for (const t of targets) {
    const id = t.split('/').pop()!
    process.stdout.write(`  ${id} ... `)
    const r = convertOne(t)
    if (!r.ok) {
      console.log(`FAIL: ${r.error}`)
      fail++
    } else if (r.changes.length === 1 && r.changes[0] === 'already-converted') {
      console.log('already converted')
      already++
    } else {
      console.log(`OK (${r.changes.join(', ')})`)
      ok++
    }
  }
  console.log(`\n[convert] ${ok} converted · ${already} already · ${fail} failed`)
}

main()
