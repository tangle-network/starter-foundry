// Proposer — takes a GapProposal from the diagnoser and dispatches the
// actual code edit through the cli-bridge sandbox harness, using the
// `sf-proposer` AgentProfile shipped at profiles/sf-proposer.json.
//
// The profile carries the system prompt + model + permissions + tools
// the proposer needs (Read/Write/Edit/Bash, no WebFetch). Replacing
// "kimi-code/kimi-for-coding" with a profile-driven dispatch decouples
// the proposer's behavior from any single CLI harness — switch
// providers/models by editing the JSON, no code changes.
//
// Sessions are keyed by `proposal-<clusterId>-<shortSha>` so a
// subsequent review comment or CI failure can resume the exact same
// conversation without re-tokenizing the full context.

import { execSync } from 'node:child_process'

import { createBridge } from '../lib/bridge.js'

import type { GapProposal } from './diagnoser.js'

export interface ProposerOptions {
  /** Dry-run: build the dispatch prompt + session key but don't actually send. */
  dryRun?: boolean
  /** Override the resume slug. Default: `proposal-<clusterId>-<sha>`. */
  resume?: string
  /** Open the PR in draft mode. Default true — humans should eyeball before merge. */
  draft?: boolean
  /** AgentProfile id to dispatch under. Defaults to 'sf-proposer' (profiles/sf-proposer.json). */
  profileId?: string
}

export interface ProposerResult {
  clusterId: string
  resumeKey: string
  dispatched: boolean
  /** The agent's final reply — typically the PR URL on success, or an error summary. */
  response: string
  reasoning?: string
}

function shortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function buildAgentTask(proposal: GapProposal, draft: boolean): string {
  const depsJson = JSON.stringify(proposal.suggestedPackageDeps, null, 2)
  return [
    `You are editing starter-foundry to close a gap-install cluster identified by the diagnoser.`,
    ``,
    `Cluster: ${proposal.clusterId}`,
    `Root cause: ${proposal.rootCause}`,
    `Suggested capability to extend: ${proposal.suggestedCapability}`,
    `Expected impact: ${proposal.expectedImpact} historical installs prevented on next replay`,
    ``,
    `Reasoning from diagnoser:`,
    `  ${proposal.reasoning.split('\n').join('\n  ')}`,
    ``,
    `Edit to make (packageDeps to merge into the capability manifest):`,
    '```json',
    depsJson,
    '```',
    ``,
    `Steps:`,
    `  1. Open registry/layers/capability/<id>/manifest.json for ${proposal.suggestedCapability}.`,
    `     If the capability does not exist, create it following the shape of an existing one (e.g. capability:tailwind).`,
    `  2. Merge the suggested packageDeps into the manifest's packageDeps field. Preserve existing deps.`,
    `  3. If appliesTo needs a wider surface for this cluster, update it — but default to minimal changes.`,
    `  4. Run: pnpm build && pnpm test — both must pass.`,
    `  5. Run: node scripts/replay-traces.ts — verify cluster ${proposal.clusterId} gap count drops.`,
    `  6. Create a new branch named fix/gap-${proposal.clusterId}-<shortSha>, commit with a message explaining the cluster + measured impact, push, and open ${draft ? 'a DRAFT' : 'a'} PR with gh pr create.`,
    `  7. Report back with the PR URL as your final message.`,
    ``,
    `Do not edit anything else. Do not rename files. Do not add new dependencies to the repo root package.json. If the edit cannot be safely made, explain why and stop.`,
  ].join('\n')
}

export async function proposeEdit(
  proposal: GapProposal,
  opts: ProposerOptions = {},
): Promise<ProposerResult> {
  const resumeKey = opts.resume ?? `proposal-${proposal.clusterId}-${shortSha()}`
  const task = buildAgentTask(proposal, opts.draft ?? true)

  if (opts.dryRun) {
    return {
      clusterId: proposal.clusterId,
      resumeKey,
      dispatched: false,
      response: '(dry-run)',
      reasoning: task,
    }
  }

  // Dispatch through sandbox harness with the sf-proposer AgentProfile.
  // Wire form: bridge/sandbox/sf-proposer. Profile carries system prompt
  // + model + permissions + tools — see profiles/sf-proposer.json.
  const profileId = opts.profileId ?? 'sf-proposer'
  const session = createBridge({ harness: 'sandbox', model: profileId, resume: resumeKey })
  const response = await session.ask(task)
  return { clusterId: proposal.clusterId, resumeKey, dispatched: true, response }
}
