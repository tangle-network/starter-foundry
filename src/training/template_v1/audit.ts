// audit.ts — compose a scaffold with the candidate template swapped in,
// run install + typecheck, ensure we don't regress vs the current template.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join } from 'node:path'

import { composeStarter } from '../../lib/compose.js'
import type { ComposeSpec } from '../../types.js'

import { checkHtmlTsWireup, findUnusedImports } from './correctness.js'

interface AuditInput {
  spec: ComposeSpec
  /** Target path inside the composed scaffold (e.g. 'src/App.tsx'). */
  templateTarget: string
  candidateSource: string
}

export interface AuditResult {
  ok: boolean
  stage: 'compose' | 'install' | 'typecheck' | 'correctness' | 'done'
  stderrTail: string
  durationMs: number
}

export async function audit(input: AuditInput): Promise<AuditResult> {
  const start = Date.now()
  const dir = mkdtempSync(join(tmpdir(), 'sf-tmpl-audit-'))
  try {
    await composeStarter({ spec: input.spec, outDir: dir })
    // Swap in the candidate.
    const target = join(dir, input.templateTarget)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, input.candidateSource)

    // Install — only if there's a package.json.
    const pkgJson = join(dir, 'package.json')
    if (existsSync(pkgJson)) {
      const inst = spawnSync('pnpm', ['install', '--no-frozen-lockfile', '--silent'], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 120_000,
      })
      if (inst.status !== 0) {
        return {
          ok: false,
          stage: 'install',
          stderrTail: (inst.stderr ?? '').slice(-1200),
          durationMs: Date.now() - start,
        }
      }
    }

    // Typecheck via the family's validate script if present.
    const tscJson = join(dir, 'tsconfig.json')
    if (existsSync(tscJson)) {
      const tsc = spawnSync('pnpm', ['exec', 'tsc', '--noEmit'], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 120_000,
      })
      if (tsc.status !== 0) {
        return {
          ok: false,
          stage: 'typecheck',
          stderrTail: ((tsc.stdout ?? '') + (tsc.stderr ?? '')).slice(-1500),
          durationMs: Date.now() - start,
        }
      }
    }

    // Correctness checks catch classes of bug tsc doesn't:
    //   - unused imports in the candidate (tsc only flags those when
    //     noUnusedLocals: true, which no family tsconfig enables)
    //   - HTML↔TS wire-up drift: missing <script src=...> files, or
    //     document.getElementById calls with no matching id in HTML
    const correctnessFailures = []
    if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(input.templateTarget))) {
      correctnessFailures.push(...findUnusedImports(input.candidateSource, input.templateTarget))
    }
    correctnessFailures.push(...checkHtmlTsWireup(dir))
    if (correctnessFailures.length > 0) {
      const tail = correctnessFailures
        .map((f) => `  [${f.kind}] ${f.file}: ${f.detail}`)
        .join('\n')
        .slice(-1500)
      return {
        ok: false,
        stage: 'correctness',
        stderrTail: `correctness checks failed (${correctnessFailures.length}):\n${tail}`,
        durationMs: Date.now() - start,
      }
    }

    return { ok: true, stage: 'done', stderrTail: '', durationMs: Date.now() - start }
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
    } catch {
      /* leak temp on failure */
    }
  }
}
