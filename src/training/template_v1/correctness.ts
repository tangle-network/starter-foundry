// correctness.ts — cheap static checks that run as part of audit() on a
// candidate template before we accept it.
//
// Two bugs the pipeline shipped in 2026-04-21 motivated this file:
//   1. An App.tsx candidate scored 0.56 and passed audit while carrying
//      `import { useState } from 'react'` that was never referenced.
//      `tsc --noEmit` doesn't flag unused imports without
//      `noUnusedLocals: true` — and none of the 50 family tsconfigs
//      enable it. The unused import is a quality smell AND would fail
//      consumer projects that do turn on strict mode.
//   2. An index.html candidate scored 0.70 and passed audit with
//      `<div id="root">` + `<script src="/src/main.tsx">` — but the
//      react-vite-ts scaffold uses `<div id="app">` and `main.ts`.
//      Audit's typecheck doesn't parse HTML and doesn't cross-reference
//      script-src against existing files; the composed project would
//      ship a blank screen at runtime.
//
// Both checks are fast, deterministic, and run on the composed
// directory after compose + install + typecheck succeed. Either check
// failing turns audit.ok=false with stage='correctness'.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

interface CorrectnessFailure {
  kind: 'unused-import' | 'missing-script-src' | 'missing-element-id' | 'entry-id-mismatch'
  file: string
  detail: string
}

/**
 * Check a single candidate TS/TSX source string for unused imports.
 * Parses top-of-file `import ... from '...'` statements and verifies
 * every bound name appears elsewhere in the file body.
 */
export function findUnusedImports(source: string, file: string): CorrectnessFailure[] {
  const failures: CorrectnessFailure[] = []
  // Only scan the import block — everything before the first non-import,
  // non-comment, non-blank line. Keeps the scan O(imports), not O(file).
  const lines = source.split('\n')
  const importLines: Array<{ line: string; lineNo: number }> = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    const t = l.trim()
    if (t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue
    if (t.startsWith('import ') || t.startsWith('import{')) {
      importLines.push({ line: l, lineNo: i + 1 })
      // multi-line import: keep accumulating until we see the closing `from '...'` or `;`
      while (i + 1 < lines.length && !/ from ['"]/.test(importLines[importLines.length - 1]!.line) && !importLines[importLines.length - 1]!.line.trim().endsWith(';')) {
        i++
        importLines[importLines.length - 1]!.line += '\n' + lines[i]!
      }
      continue
    }
    // First non-import, non-comment line — import block ended.
    break
  }

  // Body = source minus the imports we just collected. Strip line comments
  // and block comments so commented-out usages don't count as real uses.
  const bodyStart = importLines.length > 0
    ? importLines[importLines.length - 1]!.lineNo
    : 0
  const body = lines
    .slice(bodyStart)
    .join('\n')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  for (const { line } of importLines) {
    // Extract bound names from the import. Handles:
    //   import X from '...'
    //   import { A, B as C } from '...'
    //   import * as NS from '...'
    //   import X, { A } from '...'
    //   import '...'  (side-effect; nothing to check)
    const names: string[] = []
    const defaultMatch = line.match(/^\s*import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/)
    if (defaultMatch) names.push(defaultMatch[1]!)
    const nsMatch = line.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)
    if (nsMatch) names.push(nsMatch[1]!)
    const namedBlock = line.match(/\{([^}]+)\}/)
    if (namedBlock) {
      for (const piece of namedBlock[1]!.split(',')) {
        const renamed = piece.trim().match(/(?:[A-Za-z_$][\w$]*\s+as\s+)?([A-Za-z_$][\w$]*)\s*$/)
        if (renamed) names.push(renamed[1]!)
      }
    }
    // Type-only imports can be unused at value level but still affect
    // d.ts — TypeScript handles those; skip `import type`.
    if (/^\s*import\s+type\b/.test(line)) continue

    for (const name of names) {
      // Whole-word match on the name in the body.
      const re = new RegExp(`\\b${name.replace(/[$]/g, '\\$')}\\b`)
      if (!re.test(body)) {
        failures.push({
          kind: 'unused-import',
          file,
          detail: `\`${name}\` is imported but never referenced`,
        })
      }
    }
  }
  return failures
}

/**
 * Walk a composed scaffold directory and check HTML/TS wire-up:
 *   - every <script type="module" src="/X"> must resolve to an existing
 *     file in the composed tree (src/X or X from root)
 *   - every document.getElementById('ID') in the entry TS must match
 *     some <div id="ID"> (or any element with that id) in some HTML
 *   - every <div id="ID"> with a matching getElementById in the entry
 *     is considered consistent; the check is one-directional (missing
 *     TS counterpart isn't a bug — HTML may add extra mount points)
 *
 * Keeps the scan shallow: only HTML/TS at the project root + src/.
 */
export function checkHtmlTsWireup(composedDir: string): CorrectnessFailure[] {
  const failures: CorrectnessFailure[] = []
  const htmlFiles = shallowFindFiles(composedDir, ['.html'])
  if (htmlFiles.length === 0) return failures // no HTML, no wire-up

  // Aggregate all ids across every HTML file — a TS lookup of 'root'
  // is consistent if ANY HTML has <div id="root">.
  const allIds = new Set<string>()
  for (const html of htmlFiles) {
    const body = readFileSync(html, 'utf8')
    for (const m of body.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) {
      allIds.add(m[1]!)
    }
    // Each <script type="module" src="..."> must resolve.
    for (const m of body.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/g)) {
      const src = m[1]!
      if (/^https?:\/\//.test(src)) continue // external
      // Strip leading slash; resolve relative to composedDir.
      const rel = src.replace(/^\//, '')
      const path = join(composedDir, rel)
      if (!existsSync(path)) {
        failures.push({
          kind: 'missing-script-src',
          file: relative(composedDir, html),
          detail: `script src="${src}" does not exist in composed project`,
        })
      }
    }
  }

  // Scan entry TS/TSX files for getElementById calls; each must match
  // an id found in some HTML. Skip if no entries exist (non-web family).
  const entryFiles = shallowFindFiles(composedDir, ['.ts', '.tsx', '.js', '.jsx'])
    .filter((p) => /\/(main|index|App)\.(ts|tsx|js|jsx)$/.test(p))
  for (const entry of entryFiles) {
    const src = readFileSync(entry, 'utf8')
    for (const m of src.matchAll(/document\s*\.\s*getElementById\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      const id = m[1]!
      if (!allIds.has(id)) {
        failures.push({
          kind: 'missing-element-id',
          file: relative(composedDir, entry),
          detail: `document.getElementById('${id}') has no matching id="${id}" in any HTML file`,
        })
      }
    }
  }
  return failures
}

function shallowFindFiles(dir: string, extensions: string[]): string[] {
  const hits: string[] = []
  const walk = (d: string, depth: number) => {
    if (depth > 4) return
    let entries: string[] = []
    try { entries = readdirSync(d) } catch { return }
    for (const name of entries) {
      if (name === 'node_modules' || name === '.starter-foundry' || name === '.git') continue
      const full = join(d, name)
      let st
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) walk(full, depth + 1)
      else if (extensions.includes(extname(name))) hits.push(full)
    }
  }
  walk(dir, 0)
  return hits
}
