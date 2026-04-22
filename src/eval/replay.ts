// Counterfactual replay — runs captured buildout prompts against the CURRENT
// registry state, compares what the new plan+compose would have produced
// against what the agent actually did, and emits a VB-schema-compatible
// analysis. This is the inner loop of the self-update pipeline: it answers
// "did the last intervention actually close the gap?" on every commit,
// without waiting for an external VB sweep.
//
// Zero LLM calls. Zero filesystem writes beyond the final report. Pure
// re-routing via planPrompt + resolveComponents (both pure-function on the
// hot path). Typical runtime: <5s for 200+ traces.

import fs from 'node:fs/promises'
import path from 'node:path'
import { planPrompt } from '../lib/prompt-planner.js'
import { resolveComponents } from '../lib/registry.js'
import type { PromptPlan, ResolvedComponents } from '../types.js'

// ---- captured trace shape (from .evolve/traces/buildouts.jsonl v3) ----

export interface CapturedOutcome {
  source: string
  allPass: boolean
  blendedScore: number
  failingLayers: string[]
  shotsRun: number
  shotsToConvergence: number
  wallMs: number
  toolCallsTotal: number
  costUsd?: number | null
  tokenCount?: number | null
}

/** Captured addedPackages has two historical shapes in the corpus:
 *  - old v3 strings like `pnpm:lucide-react`
 *  - newer object form `{pm: 'pnpm', name: 'lucide-react'}`
 * Both are normalized by `normalizeAddedPackages` below. */
export type CapturedPackage = string | { pm: string; name: string }

export interface CapturedTrace {
  schemaVersion: number
  sessionId: string
  scenarioId: string
  partnerGuess: string | null
  replayRound: number
  initialPrompt: string
  addedPackages: CapturedPackage[]
  addedDirs?: string[]
  rewrittenFiles: string[]
  outcome: CapturedOutcome | null
}

function normalizeAddedPackages(pkgs: CapturedPackage[]): string[] {
  const out: string[] = []
  for (const p of pkgs) {
    if (typeof p === 'string') out.push(p)
    else if (p && typeof p === 'object' && typeof p.name === 'string') {
      const pm = typeof p.pm === 'string' ? p.pm : 'pnpm'
      out.push(`${pm}:${p.name}`)
    }
  }
  return out
}

// ---- per-trace replay result ----

export interface ReplayResult {
  sessionId: string
  scenarioId: string
  partner: string | null
  userRequest: string
  newFamily: string
  newLayers: string[]
  newPartner: string | null
  scaffoldDeps: string[]
  /** addedPackages the captured agent installed that the current scaffold already provides.
   * These are dead-work events that would be prevented on re-run. */
  preventedInstalls: string[]
  /** addedPackages the captured agent installed that the current scaffold still does NOT provide.
   * These are remaining gap-install events; each one is a target for the next intervention. */
  remainingGapInstalls: string[]
  /** rewrittenFiles the current scaffold already provides (by relative path match). */
  preventedRewrites: string[]
  /** Did planPrompt route to the same family the captured agent actually ended up building? */
  familyMatchHint: boolean | null
  observedOutcome: CapturedOutcome | null
}

// ---- aggregate report (VB-schema-compatible) ----

export interface CounterfactualSummary {
  generatedAt: string
  totalBuildouts: number
  withOutcome: number
  passRate: number
  meanBlendedScore: number
  totalPassing: number
  totalFailing: number
  distinctScenarios: number
  distinctPartners: string[]
  /** Total addedPackages events in the captured corpus. */
  totalHistoricalInstalls: number
  /** How many of those the current registry would now prevent. */
  totalPreventedInstalls: number
  /** How many remain as gaps under the current registry. */
  totalRemainingGapInstalls: number
  /** preventedInstalls / totalHistoricalInstalls. The scorecard metric that
   * tells us, concretely, what fraction of captured agent-install events
   * would not have happened if these agents ran against today's registry. */
  preventionRate: number
  /** Lower-is-better per scorecard.json. Derived from remainingGapInstalls
   * by dividing across corpus and extrapolating per-buildout. */
  estimatedGapInstallsPerBuildout: number
}

export interface CounterfactualReport {
  schemaVersion: 1
  generator: 'starter-foundry:replay-traces'
  registryCommit: string
  summary: CounterfactualSummary
  perScenario: Array<{
    partner: string | null
    scenarioId: string
    total: number
    withOutcome: number
    pass: number
    passRate: number
    meanScore: number
    meanWallMs: number
    meanTurns: number
    totalHistoricalInstalls: number
    totalPreventedInstalls: number
    totalRemainingGapInstalls: number
    preventionRate: number
  }>
  topRemainingGapInstalls: Array<{
    key: string
    timesRemaining: number
    remainingOnPass: number
    remainingOnFail: number
  }>
  topPreventedInstalls: Array<{
    key: string
    timesPrevented: number
  }>
}

// ---- extraction helpers ----

/** Pulls the free-text user ask out of a captured prompt. Traces prepend a
 * long sidecar/dev-server preamble; the real prompt is after `User request:\n`. */
export function userRequestFromInitialPrompt(initialPrompt: string): string {
  const marker = 'User request:\n'
  const idx = initialPrompt.indexOf(marker)
  if (idx < 0) return initialPrompt
  const rest = initialPrompt.slice(idx + marker.length)
  // Trim trailing boilerplate like "Make targeted edits..." that appears
  // on many traces. Cut at the first blank-line-preceded closing instruction.
  const cutPatterns = [
    /\n\nMake targeted edits/,
    /\n\nDo NOT recreate/,
    /\n\nProduction-shape/,
  ]
  let end = rest.length
  for (const re of cutPatterns) {
    const m = rest.match(re)
    if (m && m.index !== undefined && m.index < end) end = m.index
  }
  return rest.slice(0, end).trim()
}

/** Union deps declared by every resolved component. Mirrors how compose.ts
 * merges them into the composed package.json — but returns only the dep names
 * so we can compare against captured addedPackages. */
function effectiveDepNames(components: ResolvedComponents): string[] {
  const names = new Set<string>()
  const include = (pd?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }) => {
    if (!pd) return
    for (const k of Object.keys(pd.dependencies ?? {})) names.add(k)
    for (const k of Object.keys(pd.devDependencies ?? {})) names.add(k)
  }
  include((components.family as { packageDeps?: unknown }).packageDeps as Parameters<typeof include>[0])
  for (const layer of components.layers) {
    include((layer as { packageDeps?: unknown }).packageDeps as Parameters<typeof include>[0])
  }
  if (components.partner) {
    include((components.partner as { packageDeps?: unknown }).packageDeps as Parameters<typeof include>[0])
  }
  return [...names].sort()
}

/** Captured addedPackages are prefixed with a package-manager tag (e.g. "pnpm:lucide-react", "cargo:serde").
 * Return the bare name for comparison against scaffold deps. */
function stripPmPrefix(name: string): string {
  const idx = name.indexOf(':')
  return idx < 0 ? name : name.slice(idx + 1)
}

/** Only npm-ecosystem installs are comparable against package.json-level packageDeps.
 * cargo/go/pip installs are real signals but live in a different dep surface. */
function isNpmInstall(name: string): boolean {
  return name.startsWith('pnpm:') || name.startsWith('npm:') || name.startsWith('yarn:') || name.startsWith('bun:')
}

/** Relative-path match between captured rewrittenFiles (absolute tmp paths)
 * and the files the scaffold would write. Match on the path tail after the
 * first appearance of the project name segment. */
function relativePathTail(absPath: string): string {
  const norm = absPath.replaceAll('\\', '/')
  const parts = norm.split('/')
  // Find "src" or "app" or "pages" anchor — these are meaningful tails.
  for (const anchor of ['src', 'app', 'pages', 'components', 'lib', 'api']) {
    const idx = parts.lastIndexOf(anchor)
    if (idx >= 0) return parts.slice(idx).join('/')
  }
  return parts.slice(-2).join('/')
}

// ---- the replay primitive ----

export async function replayTrace(trace: CapturedTrace): Promise<ReplayResult> {
  const userRequest = userRequestFromInitialPrompt(trace.initialPrompt)
  let plan: PromptPlan
  let components: ResolvedComponents
  let scaffoldDeps: string[] = []
  let newFamily = 'ERR'
  let newLayers: string[] = []
  let newPartner: string | null = null

  try {
    plan = await planPrompt({ prompt: userRequest, partner: trace.partnerGuess })
    if ('projects' in plan.spec) {
      // Workspace plan — union deps + layers across every sub-project. The
      // composed scaffold for a workspace is a monorepo with per-app package.json
      // files; for gap-install prevention we care about the union because an
      // agent install happens against whichever app needs it.
      const unionDeps = new Set<string>()
      const unionLayers: string[] = []
      const familyIds: string[] = []
      let partnerSeen: string | null = null
      for (const proj of plan.spec.projects) {
        try {
          const c = await resolveComponents(proj.spec)
          effectiveDepNames(c).forEach((d) => unionDeps.add(d))
          unionLayers.push(...c.layers.map((l) => `${l.group}:${l.id}`))
          familyIds.push(c.family.id)
          if (!partnerSeen && c.partner) partnerSeen = c.partner.id
        } catch {
          // one sub-project resolution failure shouldn't kill the whole workspace measure
        }
      }
      scaffoldDeps = [...unionDeps].sort()
      newFamily = familyIds.join('+') || 'workspace'
      newLayers = unionLayers
      newPartner = partnerSeen
    } else {
      components = await resolveComponents(plan.spec)
      scaffoldDeps = effectiveDepNames(components)
      newFamily = components.family.id
      newLayers = components.layers.map((l) => `${l.group}:${l.id}`)
      newPartner = components.partner?.id ?? null
    }
  } catch {
    // Planner or registry rejected the spec. Treat as "every captured install
    // still a gap" so the trace shows up in the hot-spot rollup.
    return {
      sessionId: trace.sessionId,
      scenarioId: trace.scenarioId,
      partner: trace.partnerGuess,
      userRequest,
      newFamily,
      newLayers: [],
      newPartner: null,
      scaffoldDeps: [],
      preventedInstalls: [],
      remainingGapInstalls: normalizeAddedPackages(trace.addedPackages).filter(isNpmInstall).map(stripPmPrefix),
      preventedRewrites: [],
      familyMatchHint: null,
      observedOutcome: trace.outcome,
    }
  }

  const npmInstalls = normalizeAddedPackages(trace.addedPackages).filter(isNpmInstall).map(stripPmPrefix)
  const scaffoldDepSet = new Set(scaffoldDeps)
  const preventedInstalls: string[] = []
  const remainingGapInstalls: string[] = []
  for (const name of npmInstalls) {
    if (scaffoldDepSet.has(name)) preventedInstalls.push(name)
    else remainingGapInstalls.push(name)
  }

  const preventedRewrites: string[] = []
  const tails = trace.rewrittenFiles.map(relativePathTail)
  for (const tail of tails) {
    if (scaffoldDepSet.size > 0 && tail.endsWith('index.html')) preventedRewrites.push(tail)
    // Rough heuristic: the scaffold provides src/index.css + src/main.tsx + src/App.tsx by default
    // on vite projects; mark those as prevented if the new plan is a react-vite family.
    if (newFamily.startsWith('react-vite') || newFamily === 'electron-native-os') {
      if (tail === 'src/main.tsx' || tail === 'src/App.tsx' || tail === 'src/index.css') {
        preventedRewrites.push(tail)
      }
    }
  }

  return {
    sessionId: trace.sessionId,
    scenarioId: trace.scenarioId,
    partner: trace.partnerGuess,
    userRequest,
    newFamily,
    newLayers,
    newPartner,
    scaffoldDeps,
    preventedInstalls,
    remainingGapInstalls,
    preventedRewrites,
    familyMatchHint: null,
    observedOutcome: trace.outcome,
  }
}

// ---- corpus loader ----

export async function loadTraces(tracesDir: string): Promise<CapturedTrace[]> {
  const files = await fs.readdir(tracesDir)
  const traceFiles = files.filter((f) => f === 'buildouts.jsonl' || f.startsWith('variant_b-'))
  const out: CapturedTrace[] = []
  for (const file of traceFiles) {
    const raw = await fs.readFile(path.join(tracesDir, file), 'utf8')
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const obj = JSON.parse(line) as CapturedTrace
        if (obj && typeof obj.initialPrompt === 'string' && Array.isArray(obj.addedPackages)) {
          out.push(obj)
        }
      } catch {
        // skip malformed lines — a couple variant_b files have partial writes
      }
    }
  }
  return out
}

// ---- aggregate report ----

export function buildReport(
  results: ReplayResult[],
  registryCommit: string,
): CounterfactualReport {
  const total = results.length
  const withOutcome = results.filter((r) => r.observedOutcome != null).length
  const passing = results.filter((r) => r.observedOutcome?.allPass === true).length
  const failing = withOutcome - passing
  const meanBlendedScore =
    withOutcome > 0
      ? results.reduce((sum, r) => sum + (r.observedOutcome?.blendedScore ?? 0), 0) / withOutcome
      : 0

  const distinctScenarios = new Set(results.map((r) => r.scenarioId)).size
  const distinctPartners = [...new Set(results.map((r) => r.partner).filter((p): p is string => !!p))].sort()

  const totalHistoricalInstalls = results.reduce(
    (sum, r) => sum + r.preventedInstalls.length + r.remainingGapInstalls.length,
    0,
  )
  const totalPreventedInstalls = results.reduce((sum, r) => sum + r.preventedInstalls.length, 0)
  const totalRemainingGapInstalls = results.reduce((sum, r) => sum + r.remainingGapInstalls.length, 0)
  const preventionRate = totalHistoricalInstalls > 0 ? totalPreventedInstalls / totalHistoricalInstalls : 0
  const estimatedGapInstallsPerBuildout = total > 0 ? totalRemainingGapInstalls / total : 0

  // per-scenario rollup
  const byScenario = new Map<string, ReplayResult[]>()
  for (const r of results) {
    const key = `${r.partner ?? 'none'}::${r.scenarioId}`
    const list = byScenario.get(key) ?? []
    list.push(r)
    byScenario.set(key, list)
  }
  const perScenario = [...byScenario.entries()].map(([, list]) => {
    const sTotal = list.length
    const sWithOutcome = list.filter((r) => r.observedOutcome != null).length
    const sPass = list.filter((r) => r.observedOutcome?.allPass === true).length
    const sMeanScore = sWithOutcome > 0
      ? list.reduce((sum, r) => sum + (r.observedOutcome?.blendedScore ?? 0), 0) / sWithOutcome
      : 0
    const sMeanWall = sWithOutcome > 0
      ? list.reduce((sum, r) => sum + (r.observedOutcome?.wallMs ?? 0), 0) / sWithOutcome
      : 0
    const sMeanTurns = sWithOutcome > 0
      ? list.reduce((sum, r) => sum + (r.observedOutcome?.toolCallsTotal ?? 0), 0) / sWithOutcome
      : 0
    const sHistoricalInstalls = list.reduce(
      (sum, r) => sum + r.preventedInstalls.length + r.remainingGapInstalls.length,
      0,
    )
    const sPrevented = list.reduce((sum, r) => sum + r.preventedInstalls.length, 0)
    const sRemaining = list.reduce((sum, r) => sum + r.remainingGapInstalls.length, 0)
    return {
      partner: list[0].partner,
      scenarioId: list[0].scenarioId,
      total: sTotal,
      withOutcome: sWithOutcome,
      pass: sPass,
      passRate: sWithOutcome > 0 ? sPass / sWithOutcome : 0,
      meanScore: sMeanScore,
      meanWallMs: sMeanWall,
      meanTurns: sMeanTurns,
      totalHistoricalInstalls: sHistoricalInstalls,
      totalPreventedInstalls: sPrevented,
      totalRemainingGapInstalls: sRemaining,
      preventionRate: sHistoricalInstalls > 0 ? sPrevented / sHistoricalInstalls : 0,
    }
  }).sort((a, b) => b.totalRemainingGapInstalls - a.totalRemainingGapInstalls)

  // top remaining gaps — these are the intervention targets for the next round
  const remainingHisto = new Map<string, { times: number; onPass: number; onFail: number }>()
  for (const r of results) {
    const isPass = r.observedOutcome?.allPass === true
    for (const name of r.remainingGapInstalls) {
      const cur = remainingHisto.get(name) ?? { times: 0, onPass: 0, onFail: 0 }
      cur.times += 1
      if (isPass) cur.onPass += 1
      else cur.onFail += 1
      remainingHisto.set(name, cur)
    }
  }
  const topRemainingGapInstalls = [...remainingHisto.entries()]
    .map(([key, v]) => ({ key, timesRemaining: v.times, remainingOnPass: v.onPass, remainingOnFail: v.onFail }))
    .sort((a, b) => b.timesRemaining - a.timesRemaining)
    .slice(0, 20)

  // top prevented — evidence R1/R2-style interventions actually worked
  const preventedHisto = new Map<string, number>()
  for (const r of results) {
    for (const name of r.preventedInstalls) {
      preventedHisto.set(name, (preventedHisto.get(name) ?? 0) + 1)
    }
  }
  const topPreventedInstalls = [...preventedHisto.entries()]
    .map(([key, times]) => ({ key, timesPrevented: times }))
    .sort((a, b) => b.timesPrevented - a.timesPrevented)
    .slice(0, 20)

  return {
    schemaVersion: 1,
    generator: 'starter-foundry:replay-traces',
    registryCommit,
    summary: {
      generatedAt: new Date().toISOString(),
      totalBuildouts: total,
      withOutcome,
      passRate: withOutcome > 0 ? passing / withOutcome : 0,
      meanBlendedScore,
      totalPassing: passing,
      totalFailing: failing,
      distinctScenarios,
      distinctPartners,
      totalHistoricalInstalls,
      totalPreventedInstalls,
      totalRemainingGapInstalls,
      preventionRate,
      estimatedGapInstallsPerBuildout,
    },
    perScenario,
    topRemainingGapInstalls,
    topPreventedInstalls,
  }
}
