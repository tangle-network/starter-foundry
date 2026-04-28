#!/usr/bin/env tsx
// Re-emit committed example workspaces from the current registry. Idempotent:
// composes into a temp dir, then for any preset-shaped file under the example
// (root package.json, pnpm-workspace.yaml, root README.md, .github/workflows/ci.yml)
// it diffs and rewrites only when contents changed. User-authored files
// (scenarios/*.scenario.ts, judges/*.judge.ts, .env.example, the top-level
// .github/workflows/eval-recruiter.yml) are NEVER touched — they live alongside
// the composed bundle.
//
// CI calls this so a registry change that affects the preset surfaces as a
// workspace-file diff in the PR. Local dev calls it after editing a family
// or layer that the example depends on.
//
// Currently handles `examples/recruiter-eval-workspace`. Generalize when a
// second example workspace is added (small registry list at top of file).

import { mkdtemp, readFile, writeFile, rm, mkdir, rename, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { composePresetWorkspace } from '../src/lib/workspace-presets.js'

interface ExampleWorkspaceSpec {
  outDir: string
  presetId: string
  workspaceName: string
  choices: Record<string, string>
  /**
   * Files (relative to outDir) the syncer is allowed to overwrite. Anything
   * outside this list is treated as user-authored and left alone.
   */
  managedPaths: string[]
}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

const EXAMPLES: ExampleWorkspaceSpec[] = [
  {
    outDir: join(REPO, 'examples/recruiter-eval-workspace'),
    presetId: 'app+agent+eval',
    workspaceName: 'recruiter-eval-workspace',
    choices: {
      app: 'agent-with-ui-ts',
      agent: 'agent-runtime-recruiter-ts',
      eval: 'agent-eval-harness-ts',
    },
    managedPaths: [
      'package.json',
      'pnpm-workspace.yaml',
      '.github/workflows/ci.yml',
      'README.md',
      // env files for slots — re-emitted on every sync
      'app/.env',
      'eval/.env',
    ],
  },
]

interface SyncReport {
  outDir: string
  changed: string[]
  unchanged: string[]
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

/**
 * Atomically write {target} ← {content} via tmp+rename so a crash mid-write
 * never leaves a partial file. Uses a sibling tmp in the same dir to
 * guarantee fs.rename is atomic (cross-fs renames can't be).
 *
 * Gen-16.1 audit MEDIUM B5: previously direct writeFile, which could
 * truncate a managed file if the syncer was killed mid-multi-file run.
 */
async function atomicWrite(target: string, content: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  // A tmp suffix that includes the pid keeps concurrent syncers (an
  // operator running locally + a CI run) from clobbering each other's
  // tmp file. The sibling-dir guarantee is preserved.
  const tmpFile = `${target}.tmp.${process.pid}`
  try {
    await writeFile(tmpFile, content, 'utf8')
    await rename(tmpFile, target)
  } catch (err) {
    // Best-effort cleanup on failure so we don't leak .tmp.<pid> files.
    try {
      await unlink(tmpFile)
    } catch {
      /* ignore — tmp may not exist */
    }
    throw err
  }
}

async function syncOne(spec: ExampleWorkspaceSpec): Promise<SyncReport> {
  const tmp = await mkdtemp(join(tmpdir(), 'sf-sync-'))
  try {
    await composePresetWorkspace({
      presetId: spec.presetId,
      choices: spec.choices,
      workspaceName: spec.workspaceName,
      outDir: tmp,
    })
    const changed: string[] = []
    const unchanged: string[] = []
    // Two-phase: stage all .tmp files first, then rename them. If any
    // staging step fails, no managed file is touched. If a rename fails
    // partway through, the workspace is still consistent at the
    // file-content level (each managed file is either fully old or
    // fully new — never half-written).
    interface Pending {
      rel: string
      target: string
      fresh: string
    }
    const pending: Pending[] = []
    for (const rel of spec.managedPaths) {
      const fresh = await readIfExists(join(tmp, rel))
      if (fresh === null) continue
      const target = join(spec.outDir, rel)
      const existing = await readIfExists(target)
      if (existing === fresh) {
        unchanged.push(rel)
        continue
      }
      pending.push({ rel, target, fresh })
    }
    // Phase 1: write .tmp staging files.
    for (const p of pending) {
      await mkdir(dirname(p.target), { recursive: true })
      await writeFile(`${p.target}.tmp.${process.pid}`, p.fresh, 'utf8')
    }
    // Phase 2: atomic rename each into place.
    for (const p of pending) {
      await rename(`${p.target}.tmp.${process.pid}`, p.target)
      changed.push(p.rel)
    }
    return { outDir: spec.outDir, changed, unchanged }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

export { atomicWrite }

async function main() {
  let totalChanged = 0
  for (const spec of EXAMPLES) {
    if (!existsSync(spec.outDir)) {
      console.error(
        `[sync] target missing: ${relative(REPO, spec.outDir)} — re-run workspace-compose first`,
      )
      process.exitCode = 1
      continue
    }
    const report = await syncOne(spec)
    const rel = relative(REPO, report.outDir)
    if (report.changed.length === 0) {
      console.log(`✓ ${rel} — up to date (${report.unchanged.length} managed paths)`)
    } else {
      console.log(`! ${rel} — ${report.changed.length} file(s) re-emitted:`)
      for (const f of report.changed) console.log(`    ${f}`)
      totalChanged += report.changed.length
    }
  }
  if (totalChanged > 0 && process.env.SYNC_FAIL_ON_DRIFT === '1') {
    console.error(`[sync] ${totalChanged} file(s) drifted — failing per SYNC_FAIL_ON_DRIFT.`)
    process.exitCode = 2
  }
}

main().catch((err) => {
  console.error('[sync] fatal:', err)
  process.exit(1)
})
