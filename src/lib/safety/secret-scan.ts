// Secret detection on a composed scaffold. Run at the end of compose (or
// as a CI gate on registry PRs) so we never ship a scaffold with a leaked
// API key, session token, or hardcoded private key.

import fs from 'node:fs/promises'
import path from 'node:path'

export interface SecretMatch {
  file: string
  line: number
  kind: string
  snippet: string
}

// Pattern → label. Narrow regexes — false positives are worse than misses
// here because secret-scan errors must be CI-blocking.
const PATTERNS: Array<{ re: RegExp; kind: string }> = [
  { re: /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/g, kind: 'openai-secret-key' },
  { re: /ghp_[A-Za-z0-9]{36,}/g, kind: 'github-personal-token' },
  { re: /xoxb-[A-Za-z0-9-]{40,}/g, kind: 'slack-bot-token' },
  { re: /AKIA[0-9A-Z]{16}/g, kind: 'aws-access-key' },
  { re: /AIza[0-9A-Za-z_-]{35}/g, kind: 'google-api-key' },
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, kind: 'private-key-block' },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, kind: 'jwt' },
  { re: /postgres(?:ql)?:\/\/[^\s'"`]{10,}/g, kind: 'postgres-connection-string' },
  { re: /mongodb(?:\+srv)?:\/\/[^\s'"`]{10,}/g, kind: 'mongodb-connection-string' },
  // EVM private key shape (64 hex chars).
  { re: /0x[a-fA-F0-9]{64}/g, kind: 'evm-private-key-candidate' },
]

// Directories we don't scan — binary / generated / huge.
const SKIP_DIRS = new Set(['node_modules', 'pkg', 'target', 'dist', '.git', '.next', '.turbo'])
// Extensions we don't bother reading.
const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.wasm', '.lockb'])

async function walk(dir: string, onFile: (abs: string, rel: string) => Promise<void>, root: string = dir): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(abs, onFile, root)
    } else if (entry.isFile()) {
      if (SKIP_EXTS.has(path.extname(entry.name).toLowerCase())) continue
      await onFile(abs, path.relative(root, abs))
    }
  }
}

export async function scanDirectory(dir: string): Promise<SecretMatch[]> {
  const matches: SecretMatch[] = []
  await walk(dir, async (abs, rel) => {
    let source: string
    try {
      source = await fs.readFile(abs, 'utf8')
    } catch {
      return
    }
    // Skip files > 1MB — they're probably not secrets-bearing source.
    if (source.length > 1_000_000) return
    const lines = source.split('\n')
    for (const { re, kind } of PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(source)) !== null) {
        const lineNum = source.slice(0, m.index).split('\n').length
        const snippet = (lines[lineNum - 1] ?? '').trim().slice(0, 240)
        matches.push({ file: rel, line: lineNum, kind, snippet })
      }
    }
  })
  return matches
}
