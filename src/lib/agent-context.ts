/**
 * Agent context messages — canonical strings consumers (blueprint-agent etc.)
 * inject into their LLM system prompts when handing a scaffold to an agent.
 *
 * This module exists so consumers don't duplicate wording or hardcode knowledge
 * about personalize.css paths, Tailwind v4 cascade behavior, or AGENTS.md
 * conventions. When the contract changes, update here and republish — every
 * consumer picks it up via npm.
 */

import type { ComposeResult } from '../types.js'
import { PREVIEW_OWNERSHIP_SUMMARY } from './preview-ownership.js'

/**
 * Tells an agent how to use the personalize.css mechanism — paths, format,
 * and cascade behavior. ~50 words. Inject into agent system prompts when the
 * scaffold contains layout layers that ship a personalize.css.
 */
export const PERSONALIZATION_CSS_INSTRUCTION =
  "Before adding features, open src/personalize.css (or app/personalize.css for Next.js) and rewrite it with a color palette that fits the user's product. Use HSL CSS custom properties on :root and .dark — see the existing content for format. The cascade overrides Tailwind v4 @theme defaults."

/**
 * Tells an agent how to use the personalize.json mechanism — single source of
 * truth for brand, hero copy, feature names/descriptions, pricing tiers, and
 * footer content. Inject into agent system prompts when the scaffold contains
 * layout layers that ship a personalize.json (layout-landing) OR a framework
 * layer that ships one (fullstack-node-ts as of 0.4.6).
 *
 * The instruction is intentionally MANDATORY — "REQUIRED FIRST EDIT", not
 * "if it exists, rewrite it" — because this is the single highest-leverage
 * edit the agent can make. Without it the served preview is the scaffold
 * default and the user sees nothing of their request. Path is intentionally
 * vague ("personalize.json in the workspace") to cover both `personalize.json`
 * at the workspace root (fullstack-ts) and `src/personalize.json` (vite-react).
 */
export const PERSONALIZATION_JSON_INSTRUCTION =
  'REQUIRED FIRST EDIT: locate and rewrite personalize.json (in the workspace root or under src/, depending on family). It is the SINGLE SOURCE OF TRUTH for brand name, brand tagline, hero eyebrow, hero headline, hero subheadline, and (where present) feature names, pricing tiers, and footer content. The host shows changes through its managed preview, so refresh it after editing. Replace the placeholder content ("Starter Foundry", "Acme", "Build something people want", "Lightning fast", etc.) with copy specific to the user\'s actual product. Keep the schema shape unchanged. This is the single highest-leverage edit you can make in turn 1; do it before writing any new files or features.'

/**
 * Combined personalization instruction. Use this when injecting scaffold
 * context unless you have a reason to use one mechanism but not the other.
 */
export const PERSONALIZATION_INSTRUCTION = `${PERSONALIZATION_JSON_INSTRUCTION} ${PERSONALIZATION_CSS_INSTRUCTION}`

// ── Structured context builders ──────────────────────────────────────────
//
// These replace the old .join(' ') wall-of-text format with numbered steps.
// LLMs follow numbered instructions more reliably than prose paragraphs,
// and the structured format cuts ~40% of tokens by removing redundancy
// between the context message and AGENTS.md.

const PREVIEW_OWNERSHIP_STEP = `1. **Preview ownership:** ${PREVIEW_OWNERSHIP_SUMMARY}`

const PERSONALIZE_STEP =
  "2. **Personalize for the user's product:**\n" +
  '   - Rewrite `personalize.json` (workspace root or `src/`) — brand name, tagline, hero copy, features. This is the single highest-leverage edit.\n' +
  '   - Rewrite `personalize.css` (`src/` or `app/`) — HSL color palette on `:root` and `.dark` that fits the product.'

const BUILD_STEP_COMPOSED = (family: string) =>
  `3. **Read AGENTS.md**, then implement the user's request.\n` +
  `   The scaffold is a ${family} project. Edit existing files — don't recreate them.\n` +
  '   Use shadcn/ui components from `src/components/ui/` instead of raw HTML.'

const BUILD_STEP_CURATED =
  "3. **Read AGENTS.md** if present, then implement the user's request.\n" +
  "   Edit existing files — don't recreate them. Use shadcn/ui components if available."

const VERIFY_STEP =
  '4. **Screenshot the preview.** Fix anything broken or unstyled before responding.'

/**
 * Returns a canonical agent-context message for a freshly composed scaffold.
 * Consumers (blueprint-agent etc.) inject this into the agent's first system
 * message so the agent reads AGENTS.md, applies personalization, then extends.
 *
 * Pass the ComposeResult so we can mention the actual family in the message.
 */
export function getComposedScaffoldContext(result: ComposeResult): string {
  const family = result.components.family
  return [
    `A working ${family} scaffold has been composed in /home/agent.\n`,
    PREVIEW_OWNERSHIP_STEP,
    PERSONALIZE_STEP,
    BUILD_STEP_COMPOSED(family),
    VERIFY_STEP,
  ].join('\n\n')
}

/**
 * Returns a canonical agent-context message for a curated tarball scaffold
 * (downloaded from a static URL by the sidecar before the agent starts).
 * Same contract as getComposedScaffoldContext but doesn't depend on the
 * caller having a ComposeResult on hand.
 */
export function getCuratedScaffoldContext(): string {
  return [
    'A working project scaffold is set up in /home/agent.\n',
    PREVIEW_OWNERSHIP_STEP,
    PERSONALIZE_STEP,
    BUILD_STEP_CURATED,
    VERIFY_STEP,
  ].join('\n\n')
}
