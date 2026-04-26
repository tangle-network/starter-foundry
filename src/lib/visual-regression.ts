/**
 * Visual regression primitive. Not a pixel differ — a **structural** differ
 * over the composed scaffold.
 *
 * For code scaffolds, "what the agent sees first" is the filesystem shape +
 * entrypoint contents. A regression in the composed scaffold is a byte-level
 * change to any file inside a family's composed output.
 *
 * snapshot() walks a composed output directory and records, per file:
 *   - relative path
 *   - byte size
 *   - SHA-256 of the bytes
 *
 * diff() compares two snapshots. The result is three buckets:
 *   - added: files only in B
 *   - removed: files only in A
 *   - changed: files with different hashes
 *
 * Used by the visual golden set pipeline: we snapshot the top 20 family
 * compositions once, commit them as golden state, and re-snapshot on every
 * PR. A diff that isn't explicitly allowed fails CI.
 */

import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

export interface VisualFileEntry {
  /** Forward-slash relative path from the snapshot root. */
  path: string
  /** Byte size. */
  bytes: number
  /** SHA-256 hex digest of the file bytes. */
  sha256: string
}

export interface VisualSnapshot {
  schemaVersion: 1
  /** Identifier for the subject (e.g. "nextjs-ts" or "composed:nextjs-ts+auth:clerk"). */
  subject: string
  /** ISO 8601 timestamp. */
  generatedAt: string
  /** Files in the snapshot, sorted by path for stable JSON output. */
  files: VisualFileEntry[]
}

export interface VisualDiff {
  /** Paths present in `after` but not `before`. */
  added: string[]
  /** Paths present in `before` but not `after`. */
  removed: string[]
  /**
   * Paths present in both but with different sha256.
   * Each entry records the before/after hashes for debugging.
   */
  changed: {
    path: string
    beforeSha256: string
    afterSha256: string
    beforeBytes: number
    afterBytes: number
  }[]
}

interface SnapshotOptions {
  /** Additional globs to ignore beyond the defaults. */
  ignore?: string[]
}

const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  '.cache',
  '.turbo',
  'coverage',
  '.DS_Store',
]

function shouldIgnore(relPath: string, extraIgnores: string[]): boolean {
  const segments = relPath.split('/')
  const all = new Set([...DEFAULT_IGNORES, ...extraIgnores])
  return segments.some((s) => all.has(s))
}

async function sha256OfFile(abs: string): Promise<{ sha: string; bytes: number }> {
  const buf = await readFile(abs)
  const sha = createHash('sha256').update(buf).digest('hex')
  return { sha, bytes: buf.length }
}

async function walk(
  root: string,
  rel: string,
  ignore: string[],
  out: VisualFileEntry[],
): Promise<void> {
  const abs = rel ? join(root, rel) : root
  const entries = await readdir(abs, { withFileTypes: true })
  for (const e of entries) {
    const entryRel = rel ? `${rel}/${e.name}` : e.name
    if (shouldIgnore(entryRel, ignore)) continue
    const entryAbs = join(abs, e.name)
    if (e.isDirectory()) {
      await walk(root, entryRel, ignore, out)
    } else if (e.isFile()) {
      const { sha, bytes } = await sha256OfFile(entryAbs)
      out.push({ path: entryRel, bytes, sha256: sha })
    }
  }
}

/**
 * Walk `rootDir` recursively and produce a deterministic snapshot.
 * `subject` is an opaque label recorded in the snapshot (typically a
 * family id or composed-spec signature).
 */
export async function snapshot(
  rootDir: string,
  subject: string,
  options: SnapshotOptions = {},
): Promise<VisualSnapshot> {
  const s = await stat(rootDir)
  if (!s.isDirectory()) throw new Error(`snapshot: not a directory: ${rootDir}`)

  const files: VisualFileEntry[] = []
  await walk(rootDir, '', options.ignore ?? [], files)

  // Normalize separators (windows) to forward slash for cross-platform diffs.
  for (const f of files) f.path = f.path.split(sep).join('/')
  files.sort((a, b) => a.path.localeCompare(b.path))

  return {
    schemaVersion: 1,
    subject,
    generatedAt: new Date().toISOString(),
    files,
  }
}

/**
 * Compare two snapshots. Returns the three buckets of change.
 * A snapshot with identical files (same paths, same hashes) produces
 * empty arrays.
 */
export function diff(before: VisualSnapshot, after: VisualSnapshot): VisualDiff {
  const beforeMap = new Map(before.files.map((f) => [f.path, f]))
  const afterMap = new Map(after.files.map((f) => [f.path, f]))

  const added: string[] = []
  const removed: string[] = []
  const changed: VisualDiff['changed'] = []

  for (const [p, f] of afterMap) {
    const b = beforeMap.get(p)
    if (!b) added.push(p)
    else if (b.sha256 !== f.sha256) {
      changed.push({
        path: p,
        beforeSha256: b.sha256,
        afterSha256: f.sha256,
        beforeBytes: b.bytes,
        afterBytes: f.bytes,
      })
    }
  }
  for (const p of beforeMap.keys()) {
    if (!afterMap.has(p)) removed.push(p)
  }

  added.sort()
  removed.sort()
  changed.sort((a, b) => a.path.localeCompare(b.path))

  return { added, removed, changed }
}

/** True when the diff has no meaningful changes. */
export function isClean(d: VisualDiff): boolean {
  return d.added.length === 0 && d.removed.length === 0 && d.changed.length === 0
}
