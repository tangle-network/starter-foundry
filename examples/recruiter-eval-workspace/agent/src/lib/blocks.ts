// Structured output block parser. Splits a streaming chat response
// into typed chunks the host UI can render distinctly.
//
// Grammar: `:::<name>\n<body>\n:::` — name is alphanumeric+dashes, body
// is anything until the matching `:::` on its own line. Unmatched fences
// are passed through as prose so a partially-streamed block doesn't
// vanish from the user's view.

export type Chunk =
  | { kind: 'prose'; text: string }
  | { kind: 'block'; name: string; body: string }

const FENCE = /^:::([a-z][a-z0-9-]*)$/i

export function parseBlocks(input: string): Chunk[] {
  const lines = input.split(/\r?\n/)
  const out: Chunk[] = []
  let proseBuf: string[] = []
  let inBlock: { name: string; bodyLines: string[] } | null = null

  const flushProse = () => {
    if (proseBuf.length === 0) return
    const text = proseBuf.join('\n')
    if (text.trim().length > 0) out.push({ kind: 'prose', text })
    proseBuf = []
  }

  for (const line of lines) {
    if (inBlock) {
      if (line.trim() === ':::') {
        out.push({ kind: 'block', name: inBlock.name, body: inBlock.bodyLines.join('\n') })
        inBlock = null
      } else {
        inBlock.bodyLines.push(line)
      }
      continue
    }
    const m = FENCE.exec(line.trim())
    if (m) {
      flushProse()
      inBlock = { name: m[1] as string, bodyLines: [] }
      continue
    }
    proseBuf.push(line)
  }
  // Unclosed block at EOF — emit body as prose so the user still sees it.
  if (inBlock) {
    proseBuf.push(`:::${inBlock.name}`)
    proseBuf.push(...inBlock.bodyLines)
  }
  flushProse()
  return out
}

export function blocksOfType(chunks: Chunk[], name: string): Array<Extract<Chunk, { kind: 'block' }>> {
  return chunks.filter((c): c is Extract<Chunk, { kind: 'block' }> => c.kind === 'block' && c.name === name)
}
