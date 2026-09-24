// memory — in-process conversation memory for the resident agent.
//
// Per-thread markdown files at /home/agent/conversations/<thread-id>.md
// (or whatever CONVERSATIONS_DIR points at). The four ops are: append a
// turn, read a full conversation, list all threads, grep across all
// threads. No vector store, no embeddings, no third-party deps. The
// resident agent does the semantic-search work via its own LLM after
// `searchConversations` returns candidate turns.
//
// File format (one turn block):
//
//   \n---\nts: <iso>\nrole: <role>[\nmetadata: <one-line-json>]\n---\n\n<content>\n
//
// The parser is tolerant: malformed blocks are skipped, not thrown.
// `getConversation` returns whatever it could parse; if every block is
// malformed it returns a Conversation with `turns: []`.

import { appendFile, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Conversation, SearchHit, Turn, TurnRole } from './types.js'
import { grepSearch } from './grep.js'

const VALID_ROLES: ReadonlySet<TurnRole> = new Set(['user', 'assistant', 'system', 'tool'])

// Read env at call time so tests can configure per-test directories
// without re-importing the module.
function conversationsDir(): string {
  return process.env.CONVERSATIONS_DIR ?? '/home/agent/conversations'
}

// Path-traversal guard: thread ids are caller-supplied (often from
// untrusted webhook payloads). Reject ids that would escape the
// conversations directory — slashes, parent refs, NUL, leading dots.
function safeThreadFile(threadId: string): string {
  if (typeof threadId !== 'string' || threadId.length === 0) {
    throw new Error('memory: threadId must be a non-empty string')
  }
  if (threadId.length > 256) {
    throw new Error('memory: threadId exceeds 256 chars')
  }
  if (/[\\/\0]/.test(threadId) || threadId === '.' || threadId === '..' || threadId.startsWith('.')) {
    throw new Error(`memory: invalid threadId "${threadId}" (no slashes, NUL, or leading dot)`)
  }
  return join(conversationsDir(), `${threadId}.md`)
}

/**
 * Append a turn to a thread's markdown file. Creates the file (and the
 * conversations directory) if missing. Concurrent appenders rely on
 * POSIX atomicity of `O_APPEND` writes for individual chunks — turn
 * blocks are written in a single `appendFile` call so they cannot
 * interleave under realistic load.
 *
 * @public
 */
export async function appendTurn(threadId: string, turn: Turn): Promise<void> {
  const file = safeThreadFile(threadId)
  const dir = conversationsDir()
  await mkdir(dir, { recursive: true })

  if (!VALID_ROLES.has(turn.role)) {
    throw new Error(`memory: invalid role "${turn.role}" (expected one of ${[...VALID_ROLES].join(', ')})`)
  }
  if (typeof turn.ts !== 'string' || turn.ts.length === 0) {
    throw new Error('memory: turn.ts must be a non-empty ISO timestamp')
  }

  const metaLine = turn.metadata ? `metadata: ${JSON.stringify(turn.metadata)}\n` : ''
  const block = `\n---\nts: ${turn.ts}\nrole: ${turn.role}\n${metaLine}---\n\n${turn.content}\n`
  await appendFile(file, block, 'utf8')
}

/**
 * Read a full conversation. Returns null if the thread file does not
 * exist. Malformed turn blocks are skipped.
 *
 * @public
 */
export async function getConversation(threadId: string): Promise<Conversation | null> {
  const file = safeThreadFile(threadId)
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
  return parseConversation(threadId, text)
}

/**
 * List all thread ids with their last-modified timestamps, sorted by
 * `lastModified` descending (newest first). Returns `[]` if the
 * conversations directory does not exist yet.
 *
 * @public
 */
export async function listThreads(): Promise<Array<{ threadId: string; lastModified: string }>> {
  const dir = conversationsDir()
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const out: Array<{ threadId: string; lastModified: string }> = []
  for (const e of entries) {
    if (!e.endsWith('.md')) continue
    const threadId = e.slice(0, -3)
    let s: Awaited<ReturnType<typeof stat>>
    try {
      s = await stat(join(dir, e))
    } catch {
      continue
    }
    if (!s.isFile()) continue
    out.push({ threadId, lastModified: s.mtime.toISOString() })
  }
  out.sort((a, b) => b.lastModified.localeCompare(a.lastModified))
  return out
}

/**
 * Search across every thread for `query` (case-insensitive substring).
 * Returns up to `k` hits ordered by occurrence count, ties broken by
 * file mtime (newer first). Empty query returns `[]` — the resident
 * agent should never grep on whitespace.
 *
 * @public
 */
export async function searchConversations(query: string, k = 10): Promise<SearchHit[]> {
  if (typeof query !== 'string' || query.trim().length === 0) return []
  if (k <= 0) return []
  return grepSearch(query, conversationsDir(), k)
}

// ── parser ───────────────────────────────────────────────────────────────

interface ParsedBlock {
  turn: Turn | null
  /** Channel extracted from the first parsed block's metadata, if any. */
  channel?: string
}

/**
 * Parse a thread file into a Conversation. Exported for grep.ts to share
 * the same block-splitting logic without a circular import.
 *
 * @internal
 */
export function parseConversation(threadId: string, text: string): Conversation {
  const turns: Turn[] = []
  let channel: string | undefined
  for (const raw of splitBlocks(text)) {
    const parsed = parseBlock(raw)
    if (!parsed.turn) continue
    if (channel === undefined && parsed.channel) channel = parsed.channel
    turns.push(parsed.turn)
  }
  const startedAt = turns[0]?.ts ?? new Date(0).toISOString()
  return { threadId, channel, startedAt, turns }
}

/**
 * Split the file body into the substring of each turn block. A block
 * begins after the opening `---` line and ends just before the next
 * `---` line that opens the following block — i.e., we look for the
 * `\n---\n` separator that introduces a new turn header.
 *
 * Implementation: scan for `\n---\nts: ` occurrences (the start of every
 * well-formed block). Each occurrence marks the boundary; the substring
 * between two boundaries is one block. This is robust against `---`
 * inside content (markdown horizontal rules) because the parser only
 * treats `\n---\nts: ` as a block start.
 *
 * @internal
 */
export function splitBlocks(text: string): string[] {
  if (text.length === 0) return []
  const marker = '\n---\nts: '
  const out: string[] = []
  // Files always start with `\n---\nts: ` (because appendTurn prefixes a
  // newline). Find the first marker; anything before it is preamble we
  // discard (a corrupted prefix shouldn't kill the whole file).
  const first = text.indexOf(marker, 0)
  if (first === -1) return []
  let cursor = first + 1 // consume the leading \n; block starts at `---\nts: ...`
  while (cursor < text.length) {
    const next = text.indexOf(marker, cursor)
    if (next === -1) {
      out.push(text.slice(cursor))
      break
    }
    // The `\n` at position `next` belongs to the SEPARATOR between blocks
    // (it terminates the previous content's trailing line). Exclude it
    // from the current block so the previous block ends at the content's
    // own newline.
    out.push(text.slice(cursor, next))
    cursor = next + 1 // start next block at `---\nts: ...`
  }
  return out
}

function parseBlock(block: string): ParsedBlock {
  // Expected shape:
  //   ---\n
  //   ts: <iso>\n
  //   role: <role>\n
  //   [metadata: <json>\n]
  //   ---\n
  //   \n
  //   <content>
  // Trailing whitespace/newlines may appear before the next block.
  if (!block.startsWith('---\n')) return { turn: null }
  const rest = block.slice(4)
  const closeIdx = rest.indexOf('\n---\n')
  if (closeIdx === -1) return { turn: null }
  const header = rest.slice(0, closeIdx)
  // Content begins after `\n---\n` then a single blank line (`\n`).
  // Some appenders may omit the blank — accept either.
  let body = rest.slice(closeIdx + 5)
  if (body.startsWith('\n')) body = body.slice(1)
  // Trim exactly one trailing newline that appendTurn always adds; leave
  // any user-authored trailing newlines intact.
  if (body.endsWith('\n')) body = body.slice(0, -1)

  let ts: string | undefined
  let role: TurnRole | undefined
  let metadata: Record<string, unknown> | undefined
  let channel: string | undefined
  for (const line of header.split('\n')) {
    if (line.length === 0) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (key === 'ts') ts = value
    else if (key === 'role') {
      if (VALID_ROLES.has(value as TurnRole)) role = value as TurnRole
    } else if (key === 'metadata') {
      try {
        const parsed = JSON.parse(value) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          metadata = parsed as Record<string, unknown>
          const ch = (metadata as { channel?: unknown }).channel
          if (typeof ch === 'string') channel = ch
        }
      } catch {
        // Malformed metadata JSON — drop it, keep the rest of the turn.
      }
    }
  }
  if (!ts || !role) return { turn: null }
  const turn: Turn = { ts, role, content: body }
  if (metadata) turn.metadata = metadata
  return { turn, channel }
}
