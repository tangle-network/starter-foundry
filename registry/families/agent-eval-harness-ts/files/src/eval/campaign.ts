// Eval campaign — opinionated wrapper over `runEvalCampaign` from
// `@tangle-network/agent-eval@0.135.1`. Use this when the eval question is
// "does variant A beat variant B over scenarios × seeds?" — i.e. a
// launch-decision-grade sweep, not a smoke test.
//
// Why a separate entrypoint from `runHarness`:
//
//   - `runHarness` (runner.ts) runs each scenario once with no comparator.
//     It's the smoke-test path — operator-facing, fast, no variants.
//
//   - `runCampaign` (this file) runs (variants × scenarios × seeds) and
//     emits `RunRecord[]` + integrity reports + an optional `researchReport`
//     with paired-evidence verdicts. Capture integrity is wired by
//     construction:
//
//       - `assertLlmRoute` runs once at preflight.
//       - A per-run `FileSystemRawProviderSink` captures every provider
//         HTTP envelope.
//       - `assertRunCaptured` fires after every `endRun`; the campaign's
//         `onIntegrityFailure` policy decides whether to mark the run
//         failed or admit it with a flag.
//       - Each run is built atop a `TraceEmitter` whose `onRunComplete`
//         hooks fire the trace analyst declaratively.
//
// The four directives from `SKILL.md § Capture integrity` are part of
// the campaign's contract — the caller doesn't wire them, and skipping
// one isn't possible without rewriting the function.
//
// Reference wiring lives in `@tangle-network/agent-eval/src/eval-campaign.ts`.

import { join } from 'node:path'
import {
  runEvalCampaign,
  type CampaignRunContext,
  type CampaignRunOutcome,
  type CampaignScenario,
  type CampaignVariant,
  type EvalCampaignOptions,
  type EvalCampaignResult,
  type LlmClientOptions,
} from '@tangle-network/agent-eval'
import {
  FileSystemRawProviderSink,
  type RawProviderSink,
} from '@tangle-network/agent-eval/traces'

export interface CampaignOptions<V> {
  /** Stable campaign id — folded into the campaign fingerprint. */
  campaignId: string
  variants: CampaignVariant<V>[]
  scenarios: CampaignScenario[]
  /** Default `[0, 1, 2]`. */
  seeds?: number[]
  /** Git SHA the sweep runs against — `RunRecord` rejects unset. */
  commitSha: string
  /**
   * The per-run runner. Receives a fully-wired context (TraceEmitter, store,
   * RawProviderSink, llmOpts) and returns a `CampaignRunOutcome`. The
   * runner MUST call `ctx.emitter.startRun` before any work and
   * `ctx.emitter.endRun` / `ctx.emitter.abortRun` before returning.
   */
  runner: (ctx: CampaignRunContext<V>) => Promise<CampaignRunOutcome>
  /**
   * LLM client config — `assertLlmRoute` runs against this at preflight.
   * Must include `baseUrl` + `apiKey` for the route guard to pass with
   * default `routeRequirements`.
   */
  llmOpts: LlmClientOptions
  /**
   * Filesystem root for traces + raw events. Defaults to
   * `./.evolve/agent-eval/campaigns/<campaignId>/`.
   */
  workDir?: string
  /** Optional comparator variant id for paired stats. */
  comparator?: string
  /** Optional preregistration manifest hash (see `pre-registration.ts`). */
  preregistrationHash?: string
}

/**
 * Run a launch-decision-grade eval sweep over (variants × scenarios × seeds).
 *
 * Returns a `RunRecord[]` + integrity reports + (when `comparator` is set)
 * a `researchReport` with paired-bootstrap CIs, anytime-valid sequential
 * verdicts, and a SHA-256 campaign fingerprint.
 *
 * Capture-integrity directives are wired by construction:
 *   1. `RawProviderSink` per run (via the campaign's default `rawSinkFactory`).
 *   2. `assertLlmRoute` at preflight.
 *   3. `assertRunCaptured` after every `endRun` (policy: `'mark_failed'`).
 *   4. `onRunComplete` hooks fire on every run (caller supplies the analyst).
 *
 * Skip this and you're back to writing the same shape ad hoc — at the
 * cost of the bug class 0.22 was designed to eliminate.
 */
export async function runCampaign<V>(
  opts: CampaignOptions<V>,
): Promise<EvalCampaignResult> {
  const workDir =
    opts.workDir ?? join(process.cwd(), '.evolve', 'agent-eval', 'campaigns', opts.campaignId)
  const tracesDir = join(workDir, 'traces')

  // The store factory hands each cell its own `FileSystemTraceStore` instance
  // rooted in a per-run subdir. We can't construct a FileSystemTraceStore
  // here because the import lives in the main barrel — pull it dynamically
  // so this module stays a stable interface even if upstream re-exports
  // shift between minor versions.
  const { FileSystemTraceStore } = await import('@tangle-network/agent-eval')

  const fullOpts: EvalCampaignOptions<V> = {
    campaignId: opts.campaignId,
    variants: opts.variants,
    scenarios: opts.scenarios,
    commitSha: opts.commitSha,
    runner: opts.runner,
    llmOpts: opts.llmOpts,
    storeFactory: ({ runId }) =>
      new FileSystemTraceStore({ dir: join(tracesDir, runId) }),
    rawSinkFactory: ({ runId }): RawProviderSink =>
      new FileSystemRawProviderSink({ dir: join(workDir, 'raw-events', runId) }),
    workDir,
    onIntegrityFailure: 'mark_failed',
    ...(opts.seeds ? { seeds: opts.seeds } : {}),
    ...(opts.preregistrationHash ? { preregistrationHash: opts.preregistrationHash } : {}),
    ...(opts.comparator ? { report: { comparator: opts.comparator } } : {}),
  }

  return runEvalCampaign(fullOpts)
}

export type {
  CampaignRunContext,
  CampaignRunOutcome,
  CampaignScenario,
  CampaignVariant,
  EvalCampaignResult,
} from '@tangle-network/agent-eval'
