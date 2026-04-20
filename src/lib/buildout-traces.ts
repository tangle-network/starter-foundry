// Buildout trace corpus — typed loader + types for the agent-buildout
// signal mined from Claude Code session transcripts.
//
// Pipeline shape (each stage is a separate script, each stage's output
// feeds the next; every stage is resumable + fault-tolerant):
//
//   factory-local Claude Code JSONL sessions
//      └→ scripts/mine-buildout-sessions.mjs
//           writes .evolve/traces/buildouts.jsonl (append-only)
//
//   VB execution traces (.evolve/traces/vb-execution-*.jsonl)
//      └→ scripts/join-buildout-outcomes.mjs
//           annotates buildouts.jsonl with outcome fields
//
//   buildouts.jsonl (annotated)
//      └→ scripts/analyze-buildouts.mjs
//           writes .evolve/buildout-analysis.json (committed evidence)
//
// Every stage honors a resume file so re-running is cheap when nothing
// new arrived and idempotent when sessions are appended mid-run.

export const BUILDOUT_SCHEMA_VERSION = 2

export interface BuildoutEvent {
  schemaVersion: typeof BUILDOUT_SCHEMA_VERSION
  sessionId: string
  /** Filesystem path of the source jsonl (for audit + debugging). */
  sourcePath: string
  /**
   * Claude Code project slug — "-private-var-folders-...-factory-local-phase2-...".
   * Used to identify that this is a scaffold-buildout session, not a general one.
   */
  projectSlug: string
  /** Extracted scenarioId parsed out of the slug (e.g. "nft-mint-page"). */
  scenarioId: string | null
  /**
   * partner parsed from the slug (e.g. "ethereum-foundation", "arbitrum-stylus").
   * Matches the VB trace's partner field for the join.
   */
  partnerGuess: string | null
  /** Replay round number if present in slug ("r1", "r2", "r3"). */
  replayRound: number | null
  /** ISO 8601 of the first entry in the session. */
  firstTs: string | null
  /** ISO 8601 of the last entry. */
  lastTs: string | null
  /** Total entries in the source JSONL. */
  totalEntries: number
  /**
   * First substantive user prompt — the task description the agent was given.
   * Max 4000 chars, trimmed. Null if no user message was found.
   */
  initialPrompt: string | null
  /**
   * Packages the agent explicitly installed during the session.
   * Deduped. Captures signal like "agent had to add stripe because we didn't attach saas-billing."
   */
  addedPackages: Array<{ pm: 'npm' | 'pnpm' | 'yarn' | 'cargo' | 'go' | 'pip'; name: string }>
  /**
   * Directories created with mkdir. Normalized paths (./src/foo/bar).
   * Signal: "agent had to scaffold its own payments/ directory."
   */
  addedDirs: string[]
  /**
   * Files from the scaffold that got rewritten (Edit / Write operations).
   * Signal: "90% of agents rewrite src/App.tsx in the first 3 turns — the template is wrong."
   * Sourced from Claude Code's Edit/Write tool_use targets, not validated against a spec diff.
   */
  rewrittenFiles: string[]
  /** New files the agent created beyond the scaffold. */
  addedFiles: string[]
  /** Count of Bash tool_use invocations. */
  bashCalls: number
  /** Count of `pnpm|npm|yarn|cargo|go run|python -m` build/test calls. */
  buildCalls: number
  /** Exit codes observed for build/test calls. [] if none. */
  buildExitCodes: number[]
  /**
   * Outcome annotated later by scripts/join-buildout-outcomes.mjs from VB traces.
   * `null` means no VB trace matched (session may be mid-run, or not a VB scenario).
   */
  outcome: BuildoutOutcome | null
}

export interface BuildoutOutcome {
  source: 'vb-execution'
  allPass: boolean
  blendedScore: number
  failingLayers: string[]
  shotsRun: number
  shotsToConvergence: number | null
  wallMs: number
  toolCallsTotal: number
}

export interface MinerState {
  schemaVersion: typeof BUILDOUT_SCHEMA_VERSION
  /** Per-source-path cursor: last successfully processed line index (0-based, inclusive). */
  cursors: Record<string, number>
  /** Per-source-path last mtime observed (for detecting rewrites). */
  mtimes: Record<string, number>
  /** Sessions that errored out; skip on subsequent runs unless --force. */
  poisoned: Record<string, { ts: string; error: string }>
  /** Totals updated on each run for quick status. */
  lastRun: {
    ts: string
    sessionsScanned: number
    newEvents: number
    poisonedAdded: number
    durationMs: number
  } | null
}

/** Default paths. Overridable per-script for tests. */
export const DEFAULT_PATHS = {
  buildoutsJsonl: '.evolve/traces/buildouts.jsonl',
  minerState: '.evolve/traces/.buildouts-miner-state.json',
  errorsJsonl: '.evolve/traces/.buildouts-errors.jsonl',
  vbTracesDir: '.evolve/traces',
  analysisJson: '.evolve/buildout-analysis.json',
}

export function emptyMinerState(): MinerState {
  return {
    schemaVersion: BUILDOUT_SCHEMA_VERSION,
    cursors: {},
    mtimes: {},
    poisoned: {},
    lastRun: null,
  }
}

/**
 * Parse a factory-local project slug into `{ partnerGuess, scenarioId, replayRound }`.
 *
 * Slug shape:
 *   -private-var-folders-wk-....-T-factory-local-phase2-<partner>-<run-id>-<scenario-id>-r<N>-<same-scenario>-<nonce>
 *
 * Example:
 *   -private-var-folders-...-factory-local-phase2-ethereum-l1-mo66lt85-nft-mint-page-r1-nft-mint-page-lDU8vu
 *     → partnerGuess: "ethereum-foundation" (mapped), scenarioId: "nft-mint-page", replayRound: 1
 *
 * We return `partnerGuess` not `partner` because the slug uses VB's verticalId
 * (e.g. "ethereum-l1"), not VB's partner field (e.g. "ethereum-foundation").
 * The join script handles the mapping.
 */
export function parseSlug(slug: string): {
  partnerGuess: string | null
  scenarioId: string | null
  replayRound: number | null
} {
  const m = slug.match(/factory-local-phase2-(.+?)-mo[a-z0-9]+-(.+?)-r(\d+)-\2-[A-Za-z0-9]+$/)
  if (!m) return { partnerGuess: null, scenarioId: null, replayRound: null }
  return {
    partnerGuess: m[1] ?? null,
    scenarioId: m[2] ?? null,
    replayRound: Number.parseInt(m[3] ?? '0', 10) || null,
  }
}

/** VB's partner field uses verbose names. Our slug has short codes. Normalize. */
export const VERTICAL_TO_PARTNER: Record<string, string> = {
  'ethereum-l1': 'ethereum-foundation',
  'arbitrum-stylus': 'arbitrum-foundation',
  'base-defi': 'base-foundation',
  'bnb-chain': 'bnb-foundation',
  'tangle-blueprints-mpc': 'tangle-foundation',
  'tangle-tcloud-sandbox': 'tangle-foundation',
}

/** Does the slug describe a factory-local scaffold buildout? */
export function isBuildoutSlug(slug: string): boolean {
  return slug.startsWith('-private-var-folders-') && slug.includes('factory-local-phase2-')
}
