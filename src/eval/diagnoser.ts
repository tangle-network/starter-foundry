// LLM-backed diagnoser for remaining gap-installs. Reads the counterfactual
// replay report, deterministically clusters related packages (all
// @codemirror/* together, all @tailwindcss/* together, etc.), then asks an
// ax signature to name the root cause and propose a specific registry edit
// per cluster.
//
// Output is a GapProposal[] — structured, confidence-scored, and ready to
// feed into the bridge proposer (src/eval/propose.ts) for automated PR
// creation.
//
// Signature-based so AxGEPA can train the prompt against measured outcome
// (did the proposed edit actually drop the gap count on the next replay?).

import { ax, type AxAIService } from '@ax-llm/ax'
import { createLLM, isLLMAvailable } from '../lib/llm.js'
import type { CounterfactualReport } from './replay.js'

export interface GapCluster {
  /** Deterministic key. Usually a package-prefix or a semantic tag. */
  id: string
  /** Packages in this cluster, sorted by timesRemaining desc. */
  packages: Array<{ name: string; timesRemaining: number; remainingOnFail: number }>
  /** Total install events the cluster represents. */
  totalTimesRemaining: number
}

export interface GapProposal {
  clusterId: string
  rootCause: string
  suggestedCapability: string
  suggestedPackageDeps: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  confidence: number
  expectedImpact: number
  reasoning: string
}

// ---- deterministic clustering ----

const CLUSTER_RULES: Array<{ id: string; test: (name: string) => boolean }> = [
  { id: 'codemirror', test: (n) => n === 'codemirror' || n.startsWith('@codemirror/') },
  { id: 'tailwind', test: (n) => n === 'tailwindcss' || n.startsWith('@tailwindcss/') },
  { id: 'shadcn', test: (n) => n === 'clsx' || n === 'class-variance-authority' || n === 'tailwind-merge' || n === 'lucide-react' },
  { id: 'zk-primitives', test: (n) => n === 'snarkjs' || n === 'circomlibjs' || n === 'circomlib' || n.startsWith('@zk-kit/') },
  { id: 'evm-clients', test: (n) => n === 'ethers' || n === 'viem' || n === 'wagmi' || n.startsWith('@rainbow-me/') },
  { id: 'solana-clients', test: (n) => n === '@solana/web3.js' || n.startsWith('@solana/') },
  { id: 'ai-sdk', test: (n) => n === 'ai' || n.startsWith('@ai-sdk/') },
  { id: 'date-utils', test: (n) => n === 'date-fns' || n === 'dayjs' || n === 'moment' },
  { id: 'routing', test: (n) => n === 'react-router-dom' || n === 'react-router' || n.startsWith('@tanstack/react-router') },
  { id: 'charts', test: (n) => n === 'recharts' || n === 'd3' || n.startsWith('@nivo/') || n === 'chart.js' },
  { id: 'forms', test: (n) => n === 'react-hook-form' || n === 'zod' || n === '@hookform/resolvers' },
]

export function clusterGaps(report: CounterfactualReport): GapCluster[] {
  const buckets = new Map<string, GapCluster>()
  const otherBucket: GapCluster = { id: 'other', packages: [], totalTimesRemaining: 0 }

  for (const g of report.topRemainingGapInstalls) {
    const rule = CLUSTER_RULES.find((r) => r.test(g.key))
    const target = rule
      ? (buckets.get(rule.id) ?? { id: rule.id, packages: [], totalTimesRemaining: 0 })
      : otherBucket
    target.packages.push({
      name: g.key,
      timesRemaining: g.timesRemaining,
      remainingOnFail: g.remainingOnFail,
    })
    target.totalTimesRemaining += g.timesRemaining
    if (rule) buckets.set(rule.id, target)
  }

  const clusters = [...buckets.values()]
  if (otherBucket.packages.length > 0) clusters.push(otherBucket)
  for (const c of clusters) {
    c.packages.sort((a, b) => b.timesRemaining - a.timesRemaining)
  }
  return clusters.sort((a, b) => b.totalTimesRemaining - a.totalTimesRemaining)
}

// ---- ax signature ----

const gapDiagnoser = ax(
  '"You are a scaffold gap-install diagnoser. Agents keep installing these packages across captured buildouts even though the starter-foundry scaffold engine should have shipped them. Identify the real root cause and propose a concrete registry edit that would eliminate these installs on future runs. Prefer extending an existing capability layer (e.g. capability:code-editor) over proposing a brand new layer. Use the existing capability ids for context. Be specific: the suggestedPackageDeps should be a JSON string shaped {\\"dependencies\\": {\\"name\\": \\"^version\\"}} with exact package names. Confidence is 0.0-1.0 reflecting how sure you are this is the fix."' +
    ' clusterId:string, clusterPackages:string[], totalTimesRemaining:number, existingCapabilityIds:string[], scaffoldContext:string -> ' +
    'rootCause:string, suggestedCapability:string, suggestedPackageDeps:string, confidence:number, expectedImpact:number, reasoning:string',
)

// ---- the diagnose primitive ----

export interface DiagnoseOptions {
  llm?: AxAIService
  /** Listing of capability IDs the model can suggest extending. */
  existingCapabilities: string[]
  /** Short free-text summary of where these gaps showed up — passed to the LLM as context. */
  scaffoldContext?: string
  /** Skip clusters below this total count. */
  minTimesRemaining?: number
}

export async function diagnoseGaps(
  report: CounterfactualReport,
  opts: DiagnoseOptions,
): Promise<GapProposal[]> {
  const llm = opts.llm ?? (isLLMAvailable() ? createLLM() : null)
  if (!llm) {
    throw new Error(
      'diagnoseGaps requires an LLM. Set TANGLE_ROUTER_USER_KEY or another provider key in env.',
    )
  }

  const minCount = opts.minTimesRemaining ?? 2
  const clusters = clusterGaps(report).filter((c) => c.totalTimesRemaining >= minCount)
  const proposals: GapProposal[] = []

  for (const cluster of clusters) {
    try {
      const result = await gapDiagnoser.forward(llm, {
        clusterId: cluster.id,
        clusterPackages: cluster.packages.map((p) => p.name),
        totalTimesRemaining: cluster.totalTimesRemaining,
        existingCapabilityIds: opts.existingCapabilities,
        scaffoldContext: opts.scaffoldContext ?? '',
      })

      let suggestedPackageDeps: GapProposal['suggestedPackageDeps'] = {}
      try {
        const parsed = JSON.parse(result.suggestedPackageDeps)
        if (parsed && typeof parsed === 'object') {
          suggestedPackageDeps = parsed as GapProposal['suggestedPackageDeps']
        }
      } catch {
        // LLM returned non-JSON — fall back to inferring from cluster packages at a sane default version.
        const deps: Record<string, string> = {}
        for (const pkg of cluster.packages) deps[pkg.name] = '*'
        suggestedPackageDeps = { dependencies: deps }
      }

      proposals.push({
        clusterId: cluster.id,
        rootCause: result.rootCause,
        suggestedCapability: result.suggestedCapability,
        suggestedPackageDeps,
        confidence: Math.max(0, Math.min(1, result.confidence ?? 0)),
        expectedImpact: Math.max(0, result.expectedImpact ?? cluster.totalTimesRemaining),
        reasoning: result.reasoning ?? '',
      })
    } catch (err) {
      proposals.push({
        clusterId: cluster.id,
        rootCause: 'LLM diagnosis failed',
        suggestedCapability: 'unknown',
        suggestedPackageDeps: {},
        confidence: 0,
        expectedImpact: 0,
        reasoning: String(err),
      })
    }
  }

  return proposals.sort((a, b) => b.expectedImpact * b.confidence - a.expectedImpact * a.confidence)
}
