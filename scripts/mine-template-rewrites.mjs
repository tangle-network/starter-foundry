#!/usr/bin/env node
// Extract (template path, before, after-diff, outcome) tuples from the
// buildout corpus so the template-quality loop has real training data.
// Reads Claude Code session JSONLs, collects Edit + Write tool calls on
// registry-tracked template paths, groups by (family, template).
//
// Output: .evolve/template-rewrites/<family>.<template-basename>.jsonl
// with one JSON line per (sessionId, tool, before?, after, outcome?) tuple.
//
// This is the INPUT side of src/training/template_v1/. The synthesizer
// consumes these tuples + the current template content + the audit output
// to propose a better template.

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(REPO, '.evolve/template-rewrites')
const PROJECTS_ROOT = join(homedir(), '.claude/projects')

// Template paths worth tracking — anything the scaffold ships + mines frequently.
// Mined post-hoc; today we hard-code the top signals. Future: read from
// registry manifests' `files[].target`.
const TRACKED_TEMPLATES = new Set([
  'src/App.tsx',
  'src/main.ts',
  'src/main.tsx',
  'index.html',
  'src/index.css',
  'src/styles.css',
  'foundry.toml',
  'src/server.ts',
  'src/server.py',
  'app/page.tsx',
  'app/layout.tsx',
  'app/dashboard/page.tsx',
])

function* iterJsonl(path) {
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split('\n')) {
    if (!line) continue
    try { yield JSON.parse(line) } catch { /* skip malformed */ }
  }
}

const byTemplate = new Map() // key = relative template path, value = array of tuples

const projects = readdirSync(PROJECTS_ROOT).filter((d) => d.includes('factory-local'))
for (const proj of projects) {
  const dir = join(PROJECTS_ROOT, proj)
  if (!statSync(dir).isDirectory()) continue
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue
    const path = join(dir, f)
    for (const e of iterJsonl(path)) {
      if (e?.type !== 'assistant') continue
      const content = e?.message?.content
      if (!Array.isArray(content)) continue
      for (const part of content) {
        if (part?.type !== 'tool_use') continue
        if (part.name !== 'Edit' && part.name !== 'Write') continue
        const filePath = part.input?.file_path
        if (typeof filePath !== 'string') continue
        // Match any TRACKED_TEMPLATES suffix.
        let match = null
        for (const tmpl of TRACKED_TEMPLATES) {
          if (filePath.endsWith('/' + tmpl) || filePath.endsWith(tmpl)) {
            match = tmpl
            break
          }
        }
        if (!match) continue
        const tuple = {
          sessionSlug: proj,
          sessionFile: f,
          tool: part.name,
          templatePath: match,
          fullPath: filePath,
          old: part.input?.old_string ? String(part.input.old_string).slice(0, 2000) : null,
          new: (part.input?.new_string ?? part.input?.content ?? '').slice(0, 4000),
        }
        const arr = byTemplate.get(match) ?? []
        arr.push(tuple)
        byTemplate.set(match, arr)
      }
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true })
let totalTuples = 0
for (const [tmpl, tuples] of byTemplate) {
  const outPath = join(OUT_DIR, `${tmpl.replace(/\//g, '.')}.jsonl`)
  writeFileSync(outPath, tuples.map((t) => JSON.stringify(t)).join('\n') + '\n')
  totalTuples += tuples.length
  console.log(`  ${tmpl.padEnd(32)} ${String(tuples.length).padStart(4)} tuples → ${outPath}`)
}
console.log(`\n✓ mined ${totalTuples} template-rewrite tuples across ${byTemplate.size} templates`)
console.log('Next: src/training/template_v1/synthesize.ts consumes these to propose better templates.')
