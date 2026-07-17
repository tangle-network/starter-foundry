// harvest.ts — turn mined template-rewrite tuples into structured patterns.
// Input: .evolve/template-rewrites/<key>.jsonl files
// Output: HarvestSummary { templatePath, tuples, addedLines, removedLines,
//         commonStructuralEdits, sampleBefore, sampleAfter }

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const REWRITES_DIR = join(REPO, '.evolve/template-rewrites')

interface RewriteTuple {
  sessionSlug: string
  sessionFile: string
  tool: 'Edit' | 'Write'
  templatePath: string
  fullPath: string
  old: string | null
  new: string
}

export interface HarvestSummary {
  templatePath: string
  tupleCount: number
  writeCount: number
  editCount: number
  /** Lines that appear in many agents' "new" outputs but NOT in the current template. */
  frequentlyAddedLines: { line: string; frequency: number }[]
  /** Imports + dependency tokens agents consistently add. */
  frequentImports: { token: string; frequency: number }[]
  /** Sample "after" bodies for reference. */
  samplesAfter: string[]
  /** Sample "before → after" diffs for Edit calls. */
  editPatterns: { before: string; after: string; count: number }[]
}

function readTuples(key: string, rewritesDir: string): RewriteTuple[] {
  // Key is e.g. "src.App.tsx" — the filesystem-safe form of the template path.
  const candidate = join(rewritesDir, `${key}.jsonl`)
  if (!existsSync(candidate)) return []
  return readFileSync(candidate, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as RewriteTuple)
}

function tokenize(source: string): string[] {
  // Very small tokenizer — split on whitespace + punct, filter short.
  return source.split(/[^a-zA-Z0-9@/._-]+/).filter((t) => t.length >= 3)
}

function lineFrequency(bodies: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const body of bodies) {
    const seenInBody = new Set<string>()
    for (const raw of body.split('\n')) {
      const line = raw.trim()
      if (line.length < 8 || line.length > 160) continue
      if (seenInBody.has(line)) continue
      seenInBody.add(line)
      freq.set(line, (freq.get(line) ?? 0) + 1)
    }
  }
  return freq
}

function importFrequency(bodies: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  const importRe = /(?:import|from)\s+['"]([^'"]+)['"]/g
  for (const body of bodies) {
    const seen = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = importRe.exec(body)) !== null) {
      const mod = match[1]
      if (seen.has(mod)) continue
      seen.add(mod)
      freq.set(mod, (freq.get(mod) ?? 0) + 1)
    }
  }
  return freq
}

function editPatterns(tuples: RewriteTuple[]): { before: string; after: string; count: number }[] {
  const buckets = new Map<string, { before: string; after: string; count: number }>()
  for (const t of tuples) {
    if (t.tool !== 'Edit' || !t.old) continue
    // Bucket on a short signature — first 80 chars of the before.
    const sig = `${t.old.slice(0, 80)}→${t.new.slice(0, 80)}`
    const existing = buckets.get(sig)
    if (existing) existing.count++
    else buckets.set(sig, { before: t.old.slice(0, 240), after: t.new.slice(0, 240), count: 1 })
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 10)
}

export function harvest(templateKey: string, rewritesDir = REWRITES_DIR): HarvestSummary {
  const tuples = readTuples(templateKey, rewritesDir)
  const writes = tuples.filter((t) => t.tool === 'Write')
  const edits = tuples.filter((t) => t.tool === 'Edit')

  const newBodies = tuples.map((t) => t.new)
  const linefreq = lineFrequency(newBodies)
  const frequentlyAddedLines = [...linefreq.entries()]
    .filter(([, n]) => n >= Math.max(3, Math.floor(tuples.length * 0.2)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([line, frequency]) => ({ line, frequency }))

  const impfreq = importFrequency(newBodies)
  const frequentImports = [...impfreq.entries()]
    .filter(([, n]) => n >= Math.max(2, Math.floor(tuples.length * 0.1)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([token, frequency]) => ({ token, frequency }))

  return {
    templatePath: tuples[0]?.templatePath ?? templateKey,
    tupleCount: tuples.length,
    writeCount: writes.length,
    editCount: edits.length,
    frequentlyAddedLines,
    frequentImports,
    samplesAfter: writes.slice(0, 3).map((t) => t.new.slice(0, 1200)),
    editPatterns: editPatterns(edits),
  }
}
