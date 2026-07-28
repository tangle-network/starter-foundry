#!/usr/bin/env node
// Auto-generate a browsable docs page per family / capability / partner
// from the manifests. Output: docs/reference/<kind>/<id>.md + an index.
// Run in CI; link from README + host as GitHub-Pages/Vercel static site.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(REPO, 'docs/reference')

function readManifest(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function renderFamily(id, m) {
  const lines = [`# Family: \`${id}\``, '', m.description ?? '', '']
  if (m.taxonomy)
    lines.push(
      `**Taxonomy**: language=${m.taxonomy.language ?? '?'} · runtime=${m.taxonomy.runtime ?? '?'} · surface=${m.taxonomy.surface ?? '?'}`,
      '',
    )
  if (m.tags) lines.push(`**Tags**: ${m.tags.join(', ')}`, '')
  if (m.buildHints?.whenToUse) lines.push(`## When to use`, '', m.buildHints.whenToUse, '')
  if (m.buildHints?.firstSteps?.length) {
    lines.push('## First moves', '')
    m.buildHints.firstSteps.forEach((s) => lines.push(`- ${s}`))
    lines.push('')
  }
  if (m.buildHints?.gotchas?.length) {
    lines.push('## Gotchas', '')
    m.buildHints.gotchas.forEach((g) => lines.push(`- ${g}`))
    lines.push('')
  }
  if (m.buildHints?.placeholders?.length) {
    lines.push('## Placeholders (agent MUST replace)', '')
    m.buildHints.placeholders.forEach((p) => lines.push(`- \`${p.path}\` — ${p.description}`))
    lines.push('')
  }
  if (m.slots) {
    lines.push('## Slots', '')
    for (const [slotName, slotCfg] of Object.entries(m.slots)) {
      lines.push(
        `- \`${slotName}\` — options: ${(slotCfg.options ?? []).join(', ')} (default: \`${slotCfg.default ?? '(none)'}\`)`,
      )
    }
    lines.push('')
  }
  if (m.tieredKeywords) {
    lines.push('## Routing keywords', '')
    for (const [tier, kws] of Object.entries(m.tieredKeywords)) {
      if (Array.isArray(kws) && kws.length > 0)
        lines.push(
          `- **${tier}**: ${kws.slice(0, 20).join(', ')}${kws.length > 20 ? ` +${kws.length - 20} more` : ''}`,
        )
    }
    lines.push('')
  }
  return lines.join('\n')
}

function renderCapability(id, m) {
  const lines = [`# Capability: \`capability:${id}\``, '', m.description ?? '', '']
  if (m.appliesTo) lines.push(`**Applies to**: ${m.appliesTo.join(', ')}`, '')
  if (m.buildHints?.whenToUse) lines.push(`## When to use`, '', m.buildHints.whenToUse, '')
  if (m.packageDeps?.dependencies && Object.keys(m.packageDeps.dependencies).length > 0) {
    lines.push('## Shipped deps', '')
    for (const [k, v] of Object.entries(m.packageDeps.dependencies)) lines.push(`- \`${k}\`: ${v}`)
    lines.push('')
  }
  if (m.buildHints?.firstSteps?.length) {
    lines.push('## First moves', '')
    m.buildHints.firstSteps.forEach((s) => lines.push(`- ${s}`))
    lines.push('')
  }
  if (m.buildHints?.gotchas?.length) {
    lines.push('## Gotchas', '')
    m.buildHints.gotchas.forEach((g) => lines.push(`- ${g}`))
    lines.push('')
  }
  return lines.join('\n')
}

function renderPartner(id, m) {
  const lines = [`# Partner: \`${id}\``, '', m.description ?? '', '']
  if (m.appliesTo) lines.push(`**Applies to**: ${m.appliesTo.join(', ')}`, '')
  if (m.buildHints?.firstSteps?.length) {
    lines.push('## First moves', '')
    m.buildHints.firstSteps.forEach((s) => lines.push(`- ${s}`))
    lines.push('')
  }
  if (m.buildHints?.gotchas?.length) {
    lines.push('## Gotchas', '')
    m.buildHints.gotchas.forEach((g) => lines.push(`- ${g}`))
    lines.push('')
  }
  return lines.join('\n')
}

mkdirSync(join(OUT, 'families'), { recursive: true })
mkdirSync(join(OUT, 'capabilities'), { recursive: true })
mkdirSync(join(OUT, 'partners'), { recursive: true })

const familyIds = []
for (const id of readdirSync(join(REPO, 'registry/families'))) {
  if (id.startsWith('_') || id.startsWith('.')) continue
  const m = readManifest(join(REPO, 'registry/families', id, 'manifest.json'))
  if (!m) continue
  writeFileSync(join(OUT, 'families', `${id}.md`), renderFamily(id, m))
  familyIds.push(id)
}
const capIds = []
for (const id of readdirSync(join(REPO, 'registry/layers/capability'))) {
  if (id.startsWith('_') || id.startsWith('.')) continue
  const m = readManifest(join(REPO, 'registry/layers/capability', id, 'manifest.json'))
  if (!m) continue
  writeFileSync(join(OUT, 'capabilities', `${id}.md`), renderCapability(id, m))
  capIds.push(id)
}
const partnerIds = []
for (const id of readdirSync(join(REPO, 'registry/partners'))) {
  if (id.startsWith('_') || id.startsWith('.')) continue
  const m = readManifest(join(REPO, 'registry/partners', id, 'manifest.json'))
  if (!m) continue
  writeFileSync(join(OUT, 'partners', `${id}.md`), renderPartner(id, m))
  partnerIds.push(id)
}

// Index.
const index = [
  '# Reference — starter-foundry registry',
  '',
  'Auto-generated from manifests. Every surface the router knows about.',
  '',
  `## Families (${familyIds.length})`,
  '',
  ...familyIds.sort().map((id) => `- [\`${id}\`](families/${id}.md)`),
  '',
  `## Capabilities (${capIds.length})`,
  '',
  ...capIds.sort().map((id) => `- [\`capability:${id}\`](capabilities/${id}.md)`),
  '',
  `## Partners (${partnerIds.length})`,
  '',
  ...partnerIds.sort().map((id) => `- [\`${id}\`](partners/${id}.md)`),
  '',
]
writeFileSync(join(OUT, 'README.md'), index.join('\n'))

console.log(
  `✓ wrote docs/reference/ — ${familyIds.length} families, ${capIds.length} capabilities, ${partnerIds.length} partners`,
)
