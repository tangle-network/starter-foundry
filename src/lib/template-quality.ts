// Quality scoring for template-library versions. Computed from the audit
// output + the enrichment run's summary. Used by promote-template.mjs to
// pick `current` and by gc-template-library.mjs to decide what to keep.
//
// Formula is stable and deterministic so re-runs produce reproducible
// rankings — a version's score never drifts unless the raw audit/summary
// changes. Weights live here (not in the scripts) so tuning is one-file.

interface AuditPhase {
  phase: string
  ok?: boolean
  skipped?: string
  durationMs?: number
  checksTotal?: number
  checksPassed?: number
}

interface AuditReport {
  layerId: string
  family?: string
  pm?: string
  skipped?: string
  phases?: AuditPhase[]
}

interface EnrichmentSummary {
  familyId: string
  completed: boolean
  shotsUsed: number
  finalPass: boolean
  finalScore?: number
  wallMs: number
  shots: Array<{ shot: number; pass: boolean; durationMs: number }>
}

interface QualityScore {
  score: number
  /** Individual weighted components that sum to `score`. */
  components: {
    validationPass: number
    bundleBuildOk: number
    typecheckOk: number
    installOk: number
    richness: number
    firstShotBonus: number
    freshness: number
  }
  /** Raw dimensions — useful for debugging, not part of the score. */
  dimensions: {
    installMs: number | null
    buildMs: number | null
    tscMs: number | null
    validationMs: number | null
    fileCount: number
    shotsUsed: number
    daysOld: number
  }
}

interface ScoreInput {
  audit: AuditReport
  summary?: EnrichmentSummary | null
  /** Number of files in the layer's files/ directory (1 point per file, capped). */
  fileCount: number
  /** Version creation timestamp. */
  createdAt: string
}

const WEIGHTS = {
  validationPass: 0.30,
  bundleBuildOk: 0.25,
  typecheckOk: 0.15,
  installOk: 0.10,
  richness: 0.10,
  firstShotBonus: 0.05,
  freshness: 0.05,
} as const

function phaseOk(audit: AuditReport, name: string): boolean | null {
  const p = audit.phases?.find((ph) => ph.phase === name)
  if (!p) return null
  if (p.skipped) return true  // skip-clean (e.g., no-tsconfig) counts as ok
  return p.ok === true
}

function phaseMs(audit: AuditReport, name: string): number | null {
  const p = audit.phases?.find((ph) => ph.phase === name)
  if (!p || typeof p.durationMs !== 'number') return null
  return p.durationMs
}

function validationScore(audit: AuditReport): number {
  const p = audit.phases?.find((ph) => ph.phase === 'validationChecks')
  if (!p) return 0
  if (p.skipped === 'none-declared') return 0.5  // no ground truth declared — partial credit
  if (p.skipped) return 0
  if (typeof p.checksTotal === 'number' && typeof p.checksPassed === 'number' && p.checksTotal > 0) {
    return p.checksPassed / p.checksTotal
  }
  return p.ok === true ? 1 : 0
}

export function scoreVersion(input: ScoreInput): QualityScore {
  const { audit, summary, fileCount, createdAt } = input

  const validation = validationScore(audit)
  const buildOk = phaseOk(audit, 'build')
  const tscOk = phaseOk(audit, 'typecheck')
  const installOk = phaseOk(audit, 'install')

  // Build: if phase absent (not run), give full credit so the bar isn't
  // retroactively applied to v1 snapshots that predated --build.
  const buildComponent = buildOk === null ? 1 : buildOk ? 1 : 0
  const tscComponent = tscOk === null ? 0 : tscOk ? 1 : 0
  const installComponent = installOk === null ? 0 : installOk ? 1 : 0

  const richness = Math.min(1, fileCount / 10)

  const shotsUsed = summary?.shotsUsed ?? 0
  const firstShotBonus =
    shotsUsed === 1 ? 1 : shotsUsed <= 3 ? 0.5 : shotsUsed <= 10 ? 0.2 : 0

  const daysOld = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  const freshness = Math.max(0, 1 - Math.min(1, daysOld / 365))

  const components = {
    validationPass: WEIGHTS.validationPass * validation,
    bundleBuildOk: WEIGHTS.bundleBuildOk * buildComponent,
    typecheckOk: WEIGHTS.typecheckOk * tscComponent,
    installOk: WEIGHTS.installOk * installComponent,
    richness: WEIGHTS.richness * richness,
    firstShotBonus: WEIGHTS.firstShotBonus * firstShotBonus,
    freshness: WEIGHTS.freshness * freshness,
  }

  const score = Object.values(components).reduce((a, b) => a + b, 0)

  return {
    score: Math.max(0, Math.min(1, score)),
    components,
    dimensions: {
      installMs: phaseMs(audit, 'install'),
      buildMs: phaseMs(audit, 'build'),
      tscMs: phaseMs(audit, 'typecheck'),
      validationMs: phaseMs(audit, 'validationChecks'),
      fileCount,
      shotsUsed,
      daysOld,
    },
  }
}
