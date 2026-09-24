// parse-blocks — extracts ::: fenced output blocks from agent text.
//
// Grammar:
//   :::<type>[ key=value ...]
//   <body>
//   :::
//
// Body may contain newlines. Inline attributes are space-separated key=value
// pairs. Values without quotes terminate at the next whitespace; double-quoted
// values support spaces. Unknown block types are still parsed — callers decide
// whether to render or drop them. The parser is forgiving: malformed blocks
// degrade to a `kind: 'malformed'` entry with the raw source preserved.

export type AgentBlockKind =
  | 'artifact'
  | 'escalation'
  | 'screener-result'
  | 'audio-cue'
  | 'suggestion'
  | 'proposal'
  | 'filing'
  | 'survey'
  | string

export interface AgentBlock {
  kind: AgentBlockKind
  attrs: Record<string, string>
  body: string
  /** Byte range in the original source the block occupies, inclusive of fences. */
  range: { start: number; end: number }
  raw: string
}

export interface MalformedBlock {
  kind: 'malformed'
  reason: string
  range: { start: number; end: number }
  raw: string
}

export type ParsedBlock = AgentBlock | MalformedBlock

const FENCE_OPEN = /:::([a-z][a-z0-9-]*)([^\n]*)\n/g
const FENCE_CLOSE_LINE = /\n:::(?=\n|$)/

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const trimmed = raw.trim()
  if (!trimmed) return attrs
  let i = 0
  while (i < trimmed.length) {
    while (i < trimmed.length && /\s/.test(trimmed[i]!)) i++
    if (i >= trimmed.length) break
    const keyStart = i
    while (i < trimmed.length && trimmed[i] !== '=' && !/\s/.test(trimmed[i]!)) i++
    const key = trimmed.slice(keyStart, i)
    if (!key) break
    if (trimmed[i] !== '=') {
      attrs[key] = ''
      continue
    }
    i++ // skip '='
    let value: string
    if (trimmed[i] === '"') {
      i++
      const valueStart = i
      while (i < trimmed.length && trimmed[i] !== '"') i++
      value = trimmed.slice(valueStart, i)
      if (trimmed[i] === '"') i++
    } else {
      const valueStart = i
      while (i < trimmed.length && !/\s/.test(trimmed[i]!)) i++
      value = trimmed.slice(valueStart, i)
    }
    attrs[key] = value
  }
  return attrs
}

/**
 * Extracts every ::: fenced block from `text` in document order. Non-block
 * text is dropped — use `splitBlocksAndProse` if you need both.
 */
export function parseBlocks(text: string): ParsedBlock[] {
  const out: ParsedBlock[] = []
  if (!text) return out
  const re = new RegExp(FENCE_OPEN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const openStart = m.index
    const kind = m[1]!
    const attrsRaw = m[2] ?? ''
    const bodyStart = m.index + m[0].length
    // Find next ::: close at start of a line (or eof).
    const remainder = text.slice(bodyStart)
    const closeMatch = remainder.match(FENCE_CLOSE_LINE)
    if (!closeMatch || closeMatch.index === undefined) {
      out.push({
        kind: 'malformed',
        reason: `unterminated :::${kind} fence`,
        range: { start: openStart, end: text.length },
        raw: text.slice(openStart),
      })
      break
    }
    const body = remainder.slice(0, closeMatch.index)
    const closeEnd = bodyStart + closeMatch.index + closeMatch[0].length
    out.push({
      kind,
      attrs: parseAttrs(attrsRaw),
      body: body.replace(/\n+$/, ''),
      range: { start: openStart, end: closeEnd },
      raw: text.slice(openStart, closeEnd),
    })
    re.lastIndex = closeEnd
  }
  return out
}

export interface ProseSegment {
  kind: 'prose'
  text: string
  range: { start: number; end: number }
}

/**
 * Returns blocks AND interstitial prose, preserving order. Use this when the
 * UI renders both narrative and structured artifacts in the same stream.
 */
export function splitBlocksAndProse(text: string): (ParsedBlock | ProseSegment)[] {
  if (!text) return []
  const blocks = parseBlocks(text)
  const out: (ParsedBlock | ProseSegment)[] = []
  let cursor = 0
  for (const block of blocks) {
    if (block.range.start > cursor) {
      const proseText = text.slice(cursor, block.range.start)
      if (proseText.trim()) {
        out.push({
          kind: 'prose',
          text: proseText,
          range: { start: cursor, end: block.range.start },
        })
      }
    }
    out.push(block)
    cursor = block.range.end
  }
  if (cursor < text.length) {
    const tail = text.slice(cursor)
    if (tail.trim()) {
      out.push({ kind: 'prose', text: tail, range: { start: cursor, end: text.length } })
    }
  }
  return out
}

/**
 * Type guard for valid (non-malformed) blocks.
 */
export function isAgentBlock(block: ParsedBlock): block is AgentBlock {
  return block.kind !== 'malformed'
}
