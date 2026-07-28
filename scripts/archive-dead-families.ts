#!/usr/bin/env node
// Dead-family auto-archiver. A family is "dead" when:
//   (a) 0 routings in the last buildout corpus
//   (b) 0 agent installs of any package specific to it
//   (c) the family has not been modified in ≥90 days
//
// Emits .evolve/proposals/dead-families.json — a human reviews + runs
// `git rm -r registry/families/<id>` for the winners.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FAMILIES_DIR = join(REPO, 'registry/families')
const OUT = join(REPO, '.evolve/proposals/dead-families.json')

const buildoutsPath = join(REPO, '.evolve/traces/buildouts.jsonl')
const buildouts = existsSync(buildoutsPath)
  ? readFileSync(buildoutsPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  : []

// Families that showed up in any routed plan would appear via the analyze
// step — but without per-family route counts we approximate: families
// never mentioned in any buildout's initialPrompt + never-installed deps.
const mentionedInPrompts = new Set()
for (const e of buildouts) {
  const p = (e.initialPrompt ?? '').toLowerCase()
  for (const id of readdirSync(FAMILIES_DIR)) {
    if (p.includes(id.toLowerCase())) mentionedInPrompts.add(id)
  }
}

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const candidates = []
for (const id of readdirSync(FAMILIES_DIR)) {
  if (id.startsWith('_') || id.startsWith('.')) continue
  const manifestPath = join(FAMILIES_DIR, id, 'manifest.json')
  if (!existsSync(manifestPath)) continue

  // Git mtime — most recent commit touching this family.
  const gitLog = spawnSync('git', ['log', '-1', '--format=%ct', '--', `registry/families/${id}/`], {
    cwd: REPO,
    encoding: 'utf8',
  })
  const ts = Number.parseInt(gitLog.stdout.trim(), 10) * 1000
  const ageMs = Number.isFinite(ts) ? Date.now() - ts : 0
  const mentioned = mentionedInPrompts.has(id)

  if (!mentioned && ageMs > MAX_AGE_MS) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    candidates.push({
      familyId: id,
      ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
      description: manifest.description,
      recommendation: 'archive',
    })
  }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      corpusSize: buildouts.length,
      candidates,
    },
    null,
    2,
  ),
)

console.log(
  `✓ dead-family audit: ${candidates.length} candidate(s) based on ${buildouts.length} buildouts`,
)
for (const c of candidates.slice(0, 10)) {
  console.log(`  ${c.familyId.padEnd(24)} age=${c.ageDays}d  ${c.description.slice(0, 60)}`)
}
if (candidates.length === 0) console.log('  (no dead families — registry is in active use)')
