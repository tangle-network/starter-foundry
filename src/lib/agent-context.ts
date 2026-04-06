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

/**
 * Tells an agent how to use the personalize.css mechanism — paths, format,
 * and cascade behavior. ~50 words. Inject into agent system prompts when the
 * scaffold contains layout layers that ship a personalize.css.
 */
export const PERSONALIZATION_CSS_INSTRUCTION =
  'Before adding features, open src/personalize.css (or app/personalize.css for Next.js) and rewrite it with a color palette that fits the user\'s product. Use HSL CSS custom properties on :root and .dark — see the existing content for format. The cascade overrides Tailwind v4 @theme defaults.'

/**
 * Tells an agent how to use the personalize.json mechanism — single source of
 * truth for brand, hero copy, feature names/descriptions, pricing tiers, and
 * footer content. Inject into agent system prompts when the scaffold contains
 * layout layers that ship a personalize.json (currently layout-landing).
 */
export const PERSONALIZATION_JSON_INSTRUCTION =
  'If src/personalize.json exists, rewrite it before adding features. It is the single source of truth for brand name, hero copy, feature names and descriptions, pricing tiers, and footer content — every user-visible string on the landing page reads from this file. Replace the placeholder content (Acme, "Build something people want", "Lightning fast", etc.) with copy specific to the user\'s product. Keep the schema shape unchanged.'

/**
 * Combined personalization instruction. Use this when injecting scaffold
 * context unless you have a reason to use one mechanism but not the other.
 */
export const PERSONALIZATION_INSTRUCTION =
  `${PERSONALIZATION_JSON_INSTRUCTION} ${PERSONALIZATION_CSS_INSTRUCTION}`

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
    `A working project scaffold has been composed in /home/agent by starter-foundry (family: ${family}).`,
    'Read /home/agent/AGENTS.md first — it contains the architecture notes, build commands, suggested pages and components, design rules, and personalization instructions.',
    PERSONALIZATION_INSTRUCTION,
    'If shadcn/ui components are present in src/components/ui/, use them instead of raw HTML.',
    'Make targeted edits to extend the scaffold for the user request — do NOT recreate files that already exist.',
    'After writing UI code, screenshot the preview to verify it renders correctly.',
  ].join(' ')
}

/**
 * Returns a canonical agent-context message for a curated tarball scaffold
 * (downloaded from a static URL by the sidecar before the agent starts).
 * Same contract as getComposedScaffoldContext but doesn't depend on the
 * caller having a ComposeResult on hand.
 */
export function getCuratedScaffoldContext(): string {
  return [
    'A working project scaffold is set up in /home/agent.',
    'Read /home/agent/AGENTS.md first if present — it contains the build plan and personalization instructions.',
    PERSONALIZATION_INSTRUCTION,
    'Make the minimum set of file edits needed to satisfy the user request.',
    'Do not spend time on broad repo exploration.',
    'If shadcn/ui components are available (src/components/ui/), use them instead of raw HTML.',
    'After writing UI code, screenshot the preview to verify it renders correctly. Fix any unstyled elements before responding.',
  ].join(' ')
}
