/**
 * compose-prompt — high-level "free-text → composed scaffold" entrypoint.
 *
 * This is the function consumers should call when they have a user prompt
 * and want a scaffold on disk. It handles:
 *
 *   1. planPrompt() to route the prompt to a family + capabilities + industry
 *   2. Family-default capability attachment (e.g. tailwind+shadcn for React)
 *   3. composeStarter() to write files
 *   4. Returns the ComposeResult plus the resolved family and a context message
 *      ready to inject into an agent's system prompt
 *
 * Why this exists: the previous integration pattern was for callers to
 * planPrompt → manually mutate the spec → composeStarter → build their own
 * context message. That coupled callers to registry knowledge (which families
 * are React-flavored) and made them duplicate the canonical agent instruction
 * wording across their codebase. This function is the single supported entrypoint.
 */

import { composeStarter } from './compose.js'
import { planPrompt } from './prompt-planner.js'
import { getComposedScaffoldContext } from './agent-context.js'
import type { ComposeResult, ComposeSpec } from '../types.js'

export interface ComposeFromPromptOptions {
  /** Free-text user prompt — drives family routing and industry detection. */
  prompt: string
  /** Output directory for the composed scaffold. */
  outDir: string
  /** Optional partner ID to bias routing (coinbase, tangle, etc). */
  partner?: string | null
  /** Override the project name. Defaults to "scaffold". */
  projectName?: string
}

export type ComposeFromPromptResult =
  | {
      kind: 'starter'
      spec: ComposeSpec
      result: ComposeResult
      contextMessage: string
    }
  | {
      kind: 'workspace'
      reason: string
    }
  | {
      kind: 'error'
      error: string
    }

/**
 * Compose a scaffold from a free-text prompt. Returns a discriminated union
 * so callers handle workspace and error cases explicitly.
 *
 * Workspace prompts (multi-project) are not composed automatically — they
 * need a workspace spec, and the caller should fall through to from-scratch
 * agent build or call composeWorkspace directly.
 */
export async function composeFromPrompt(
  options: ComposeFromPromptOptions,
): Promise<ComposeFromPromptResult> {
  const { prompt, outDir, partner = null, projectName = 'scaffold' } = options

  if (!prompt || prompt.trim().length === 0) {
    return { kind: 'error', error: 'prompt is required' }
  }

  let plan
  try {
    plan = await planPrompt({ prompt, partner })
  } catch (err) {
    return { kind: 'error', error: `planPrompt failed: ${(err as Error).message}` }
  }

  if (plan.kind !== 'starter') {
    return {
      kind: 'workspace',
      reason: 'multi-project workspace prompts are not auto-composed; caller should compose each project explicitly',
    }
  }

  // planPrompt has already attached capabilities, industry, and family-default
  // capabilities (tailwind + shadcn for React families). The spec is ready to compose.
  const spec: ComposeSpec = {
    ...plan.spec,
    projectName,
  }

  let result: ComposeResult
  try {
    result = await composeStarter({ spec, outDir })
  } catch (err) {
    return { kind: 'error', error: `composeStarter failed: ${(err as Error).message}` }
  }

  return {
    kind: 'starter',
    spec,
    result,
    contextMessage: getComposedScaffoldContext(result),
  }
}
