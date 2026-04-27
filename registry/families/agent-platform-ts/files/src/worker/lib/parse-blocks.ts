// parse-blocks — extract `:::kind attr="val"` fenced blocks from agent
// output text. Mirrors the parser shape from ui-adapter:blocks-renderer
// so the platform UI can render artifacts the same way single-agent
// scaffolds do.
//
// Format:
//   :::artifact title="Q3 Plan" id="art-1"
//   # body markdown
//   :::

export interface OutputBlock {
  kind: string
  attrs: Record<string, string>
  body: string
}

const BLOCK_RE = /^:::([a-z][a-z0-9-]*)([^\n]*)\n([\s\S]*?)\n:::\s*$/gm

export function parseBlocks(text: string): { blocks: OutputBlock[]; stripped: string } {
  const blocks: OutputBlock[] = []
  const stripped = text.replace(BLOCK_RE, (_match, kind: string, rawAttrs: string, body: string) => {
    blocks.push({ kind, attrs: parseAttrs(rawAttrs), body: body.trim() })
    return '' // remove the block from the visible stream
  })
  return { blocks, stripped: stripped.replace(/\n{3,}/g, '\n\n').trim() }
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  // matches:  key="value with spaces"  or  key=bareword
  const re = /([a-zA-Z_][a-zA-Z0-9_-]*)=(?:"([^"]*)"|([^\s"]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    out[m[1]!] = m[2] ?? m[3] ?? ''
  }
  return out
}
