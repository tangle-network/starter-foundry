// Eval + validation result + context-pack + media types — what consumers
// see when they run validate / benchmark / context against a composed
// scaffold.

import type { BuildPlan, ComposeComponents } from './compose.js'
import type { PreviewHint, ValidationCheck } from './registry.js'

export interface ValidationCheckResult {
  ok: boolean
  check: ValidationCheck
  durationMs: number
  result?: unknown
  error?: string
}

export interface ValidationResult {
  ok: boolean
  outDir: string
  checks: ValidationCheckResult[]
}

export interface BenchmarkStats {
  min: number
  max: number
  mean: number
  p50: number
  p95: number
  samples: number
}

export interface BenchmarkRunResult {
  runId: number
  outDir: string
  composeMs: number
  primaryArtifactMs: number
  primaryArtifactTargetMs: number
  meetsPrimaryArtifactTarget: boolean
  validateMs: number
  contextMs: number
  totalMs: number
  ok: boolean
  filesWritten: number
  checksPassed: number
  checksTotal: number
  contextPath: string
}

export interface BenchmarkReport {
  schemaVersion: 1
  generatedAt: string
  projectName: string
  runs: number
  results: BenchmarkRunResult[]
  summary: {
    composeMs: BenchmarkStats
    primaryArtifactMs: BenchmarkStats
    primaryArtifactTargetMs: number
    primaryArtifactHitRate: number
    validateMs: BenchmarkStats
    contextMs: BenchmarkStats
    totalMs: BenchmarkStats
    passRate: number
  }
}

export interface ContextPack {
  schemaVersion: 1
  generatedAt: string
  projectName: string
  components: ComposeComponents
  variables: Record<string, unknown>
  files: string[]
  fileOwnership: Record<string, string>
  commands: string[]
  entrypoints: string[]
  preview: PreviewHint | null
  extensionPoints: string[]
  validationChecks: ValidationCheck[]
  agentBrief: {
    summary: string
    firstMoves: string[]
  }
  buildPlan?: BuildPlan
  userPrompt?: string | null
}

export interface MediaSlot {
  id: string
  path: string
  width: number
  height: number
  purpose: string
  prompt: string
  fallback: 'gradient' | 'icon' | 'initials' | 'text' | 'none'
  usedIn: string
}

export interface MediaManifest {
  slots: MediaSlot[]
}
