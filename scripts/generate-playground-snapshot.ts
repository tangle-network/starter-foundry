#!/usr/bin/env node
// Emits a static JSON snapshot of the registry + template-library + a
// sample composed files list for each family, consumed by
// docs/explorer/playground.html. Fully offline: no network calls.
//
// Regenerate after registry changes:
//   node scripts/generate-playground-snapshot.ts
//
// The snapshot is checked into the repo so the playground works when
// opened directly from docs/explorer/playground.html or hosted as a
// static page (GitHub Pages, Vercel, etc.) without any build step.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readFamilies() {
  const dir = join(REPO, 'registry/families')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((id) => {
      const manifestPath = join(dir, id, 'manifest.json')
      const manifest = readJson(manifestPath)
      if (!manifest) return null
      return {
        id,
        description: manifest.description ?? '',
        tieredKeywords: manifest.tieredKeywords ?? {},
        keywords: manifest.keywords ?? [],
      }
    })
    .filter(Boolean)
}

function readCapabilities() {
  const dir = join(REPO, 'registry/layers/capability')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((id) => {
      const manifest = readJson(join(dir, id, 'manifest.json'))
      if (!manifest) return null
      return {
        id,
        description: manifest.description ?? '',
        appliesTo: manifest.appliesTo ?? [],
        tieredKeywords: manifest.tieredKeywords ?? {},
        keywords: manifest.keywords ?? [],
      }
    })
    .filter(Boolean)
}

function readPartners() {
  const dir = join(REPO, 'registry/partners')
  if (!existsSync(dir)) return []
  return readdirSync(dir).map((id) => ({ id }))
}

function readLibrary() {
  const dir = join(REPO, '.evolve/template-library')
  if (!existsSync(dir)) return {}
  const out = {}
  for (const family of readdirSync(dir)) {
    const idx = readJson(join(dir, family, '_index.json'))
    if (idx) out[family] = { current: idx.current, topN: idx.topN ?? [] }
  }
  return out
}

function readSampleComposedFiles(familyId) {
  // Enumerate the files the family's framework layer + family files dir
  // would compose, without actually running compose(). Just lists the
  // target paths from the manifests + files/ entries.
  const out = []
  const familyFilesDir = join(REPO, 'registry/families', familyId, 'files')
  if (existsSync(familyFilesDir)) {
    walk(familyFilesDir, '', out)
  }
  const layerManifest = readJson(join(REPO, 'registry/layers/framework', familyId, 'manifest.json'))
  if (layerManifest?.files) {
    for (const f of layerManifest.files) out.push(f.target)
  }
  return [...new Set(out)].sort().slice(0, 30)
}

function walk(dir, prefix, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    const rel = prefix ? `${prefix}/${name}` : name
    if (st.isDirectory()) walk(full, rel, out)
    else out.push(rel)
  }
}

function readAgentsPreview(familyId) {
  // Look for AGENTS.md in family or framework-layer files dir.
  const candidates = [
    join(REPO, 'registry/families', familyId, 'files/AGENTS.md'),
    join(REPO, 'registry/layers/framework', familyId, 'files/AGENTS.md'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf8')
      return content.slice(0, 600)
    }
  }
  return null
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  families: readFamilies(),
  capabilities: readCapabilities(),
  partners: readPartners(),
  library: readLibrary(),
  composedFiles: {},
  agentsPreview: {},
}

for (const f of snapshot.families) {
  snapshot.composedFiles[f.id] = readSampleComposedFiles(f.id)
  const preview = readAgentsPreview(f.id)
  if (preview) snapshot.agentsPreview[f.id] = preview
}

const outPath = join(REPO, 'docs/explorer/playground-snapshot.json')
writeFileSync(outPath, JSON.stringify(snapshot, null, 2))

console.log(`wrote: ${outPath}`)
console.log(`  families:     ${snapshot.families.length}`)
console.log(`  capabilities: ${snapshot.capabilities.length}`)
console.log(`  partners:     ${snapshot.partners.length}`)
console.log(`  library:      ${Object.keys(snapshot.library).length}`)
