#!/usr/bin/env node
// Scan mined Claude sessions for Edit/Write tool calls on specific template
// files. Emit sample before/after snippets so we can see what agents keep
// changing — raw signal behind .evolve/buildout-analysis.json topRewrittenFiles.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const PROJECTS_ROOT = join(homedir(), '.claude', 'projects')
const TARGETS = process.argv.slice(2)
if (TARGETS.length === 0) {
  console.error('usage: inspect-rewrites.mjs <file basename> [file basename ...]')
  process.exit(1)
}

function* iterJsonl(file) {
  const raw = readFileSync(file, 'utf8')
  for (const line of raw.split('\n')) {
    if (!line) continue
    try { yield JSON.parse(line) } catch {}
  }
}

const matches = new Map()
for (const t of TARGETS) matches.set(t, [])

const projects = readdirSync(PROJECTS_ROOT).filter(d => d.startsWith('-private-var-folders') || d.includes('factory-local'))
for (const proj of projects) {
  const dir = join(PROJECTS_ROOT, proj)
  if (!statSync(dir).isDirectory()) continue
  const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'))
  for (const f of files) {
    const path = join(dir, f)
    for (const e of iterJsonl(path)) {
      if (e?.type !== 'assistant') continue
      const content = e?.message?.content
      if (!Array.isArray(content)) continue
      for (const part of content) {
        if (part?.type !== 'tool_use') continue
        const input = part?.input ?? {}
        const tool = part.name
        if (tool !== 'Edit' && tool !== 'Write') continue
        const p = typeof input.file_path === 'string' ? input.file_path : null
        if (!p) continue
        for (const t of TARGETS) {
          if (p.endsWith('/' + t) || p.endsWith(t)) {
            const entry = {
              session: proj,
              tool,
              path: p,
              old: tool === 'Edit' ? (input.old_string || '').slice(0, 400) : null,
              new: (input.new_string || input.content || '').slice(0, 400),
            }
            matches.get(t).push(entry)
          }
        }
      }
    }
  }
}

for (const [target, entries] of matches) {
  console.log(`\n=== ${target}: ${entries.length} rewrites ===`)
  for (let i = 0; i < Math.min(5, entries.length); i++) {
    const e = entries[i]
    console.log(`\n--- sample ${i+1} (${e.tool}) ---`)
    if (e.old) console.log('OLD:', e.old.replace(/\n/g, '\\n').slice(0, 250))
    console.log('NEW:', e.new.replace(/\n/g, '\\n').slice(0, 400))
  }
}
