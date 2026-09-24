// memory — type definitions for the in-process conversation memory layer.
//
// A Conversation is a single thread (e.g., one Telegram chat, one Discord
// DM, one webhook session). It is stored as a markdown file at
// /home/agent/conversations/<thread-id>.md. The file format is a sequence
// of YAML-front-matter-delimited turns:
//
//   ---
//   ts: 2026-04-26T12:34:56.000Z
//   role: user
//   ---
//
//   <content>
//
// Future siblings (vector-store layer) will index these files; for now the
// search path is a zero-dep filesystem grep.

export type TurnRole = 'user' | 'assistant' | 'system' | 'tool'

export interface Turn {
  /** ISO-8601 timestamp at append time. */
  ts: string
  /** Speaker role. */
  role: TurnRole
  /** Free-form content. May contain newlines; the `---` delimiter is the
   *  only forbidden literal at the start of a line — `appendTurn` does
   *  not sanitize it, so callers MUST avoid embedding `\n---\n` blocks. */
  content: string
  /** Optional caller-supplied metadata. Not parsed by this layer; stored
   *  inside the front-matter as a JSON object on a single line if
   *  present. */
  metadata?: Record<string, unknown>
}

export interface Conversation {
  /** Stable id — caller-chosen. Telegram chat id, generated UUID, etc. */
  threadId: string
  /** Optional channel hint (`telegram`, `discord`, …). Stored in the
   *  first turn's metadata if the caller provides it; this layer does
   *  not enforce a channel registry. */
  channel?: string
  /** ISO timestamp of the first turn. */
  startedAt: string
  turns: Turn[]
}

export interface SearchHit {
  threadId: string
  /** Zero-based index of the turn within the parsed conversation. */
  turnIdx: number
  /** ~100-char excerpt of the match (±50 chars around the first occurrence
   *  in the turn), with the original casing preserved. */
  snippet: string
  /** Number of times the (case-insensitive) query substring appears in
   *  the turn's content. Higher = more relevant; ties broken by
   *  recency (file mtime). */
  score: number
}
