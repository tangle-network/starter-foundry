// memory/grep — zero-dep filesystem grep across conversation .md files.
//
// Case-insensitive substring match. Per-turn scoring: score = number of
// non-overlapping occurrences of the query in the turn's content. Ties
// across turns are broken by recency (file mtime, newer first). Returns
// up to `k` hits.
//
// No vector store. No embeddings. No third-party deps. The bundle's
// resident agent does the semantic-search work via its own LLM after
// this returns candidate turns.

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { SearchHit } from './types.js'
import { parseConversation } from './index.js'

interface ScoredHit extends SearchHit {
  /** mtime epoch ms — used only for tie-breaking, not exposed to caller. */
  _mtime: number
}

/**
 * Filesystem grep across conversation .md files in `dir`.
 *
 * Matching: case-insensitive substring, on the per-turn `content` field.
 * Scoring: number of non-overlapping query occurrences in the turn.
 * Snippet: ±50 chars around the FIRST match in the turn, trimmed to
 * line boundaries where possible, with original casing preserved.
 *
 * Performance: O(N) over total conversation bytes — we read every file.
 * Acceptable up to roughly 10K threads × 100KB each (~1GB scan, ~2-5s
 * wall on local SSD). At larger scales, swap this for a sibling
 * vector-store layer.
 *
 * @public
 */
export async function grepSearch(query: string, dir: string, k: number): Promise<SearchHit[]> {
  const q = query.toLowerCase()
  if (q.length === 0 || k <= 0) return []

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  const hits: ScoredHit[] = []
  for (const e of entries) {
    if (!e.endsWith('.md')) continue
    const path = join(dir, e)
    let st: Awaited<ReturnType<typeof stat>>
    let text: string
    try {
      st = await stat(path)
      if (!st.isFile()) continue
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }
    const threadId = e.slice(0, -3)
    const conv = parseConversation(threadId, text)
    const mtime = st.mtime.getTime()

    for (let i = 0; i < conv.turns.length; i++) {
      const turn = conv.turns[i]
      if (!turn) continue
      const lower = turn.content.toLowerCase()
      const score = countOccurrences(lower, q)
      if (score === 0) continue
      const firstAt = lower.indexOf(q)
      const snippet = makeSnippet(turn.content, firstAt, q.length)
      hits.push({
        threadId,
        turnIdx: i,
        snippet,
        score,
        _mtime: mtime,
      })
    }
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b._mtime - a._mtime
  })

  return hits.slice(0, k).map(({ _mtime: _m, ...rest }) => rest)
}

/**
 * Count non-overlapping occurrences of `needle` (already lowercased) in
 * `haystack` (already lowercased). Empty needle returns 0.
 */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0
  let count = 0
  let from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    count++
    from = idx + needle.length
  }
  return count
}

/**
 * Build a ~100-char snippet centered on the first match. Original casing
 * preserved. Snippet is trimmed to line boundaries when those fall
 * within the window so we don't emit half-words. Prepends `…` / appends
 * `…` when truncating.
 */
function makeSnippet(content: string, matchStart: number, matchLen: number): string {
  const RADIUS = 50
  const start = Math.max(0, matchStart - RADIUS)
  const end = Math.min(content.length, matchStart + matchLen + RADIUS)
  // Collapse all internal whitespace to single spaces so the snippet is a
  // single line, regardless of where the radius landed inside multi-line
  // content. Trim leading/trailing whitespace from the windowed slice.
  const slice = content.slice(start, end).replace(/\s+/g, ' ').trim()
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return `${prefix}${slice}${suffix}`
}
