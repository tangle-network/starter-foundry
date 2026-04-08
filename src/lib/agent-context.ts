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
 * Tells the agent to start the dev server via the runtime's
 * `ensure_dev_server` route as STEP 0 — before reading anything else, before
 * making any edits, before polishing. The runtime exposes an idempotent
 * route that auto-installs and starts the dev server in one call; the
 * agent's only job is to fire the route immediately.
 *
 * This instruction has to land in the context message itself (not just in
 * AGENTS.md) and has to be FRONT-LOADED (first instruction, not buried)
 * because:
 *   1. The agent's default tool-use prompt tells it to run package-manager
 *      commands directly, which races the runtime and skips the typed error
 *      path. The framing has to be loud enough to override that default.
 *   2. Reasoning models (e.g. zai/glm-5.1) tend to over-deliberate. If the
 *      instruction is buried, they polish files for many turns before
 *      starting the server, and the user sees nothing.
 *   3. Without runtime tracking the user's preview pane never wires up,
 *      regardless of whether the dev server is technically running.
 */
export const ENSURE_DEV_SERVER_INSTRUCTION =
  'STEP 0 (do this BEFORE anything else, BEFORE reading other files, BEFORE editing): start the dev server. Run this exact command in `bash` immediately: `curl -fsS -X POST "http://localhost:${SIDECAR_PORT:-9000}/process/ensure-dev-server" -H "Content-Type: application/json" -H "Authorization: Bearer ${SIDECAR_AUTH_TOKEN}" -d \'{}\'`. It is idempotent (safe to call multiple times — returns the same pid), auto-installs dependencies on first call, and surfaces typed error codes (`WORKSPACE_NOT_FOUND`, `NO_RUNNABLE_PROJECT`, `INSTALL_FAILED`, `DEV_COMMAND_NOT_FOUND`, `DEV_PROCESS_EXITED`, `PORT_BIND_FAILED`) you can react to. The `SIDECAR_PORT` and `SIDECAR_AUTH_TOKEN` environment variables are pre-set in your bash environment — you do NOT need to look them up or set them. CRITICAL: Do NOT run `pnpm install`, `pnpm dev`, `npm install`, `npm run dev`, `next dev`, `vite`, `cargo run`, or any other dev/install command via `bash` directly — those bypass the runtime tracking and the user\'s preview pane will not wire up. After Step 0 returns success, then you can read files and start editing. Subsequent edits hot-reload via HMR; do NOT call this again to restart unless the response says you should.'

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
    // Step 0: dev server. Front-loaded BEFORE any other instruction so the
    // agent's first action is "make the user see a preview ASAP", not
    // "polish files for 5 minutes then forget to start the server".
    ENSURE_DEV_SERVER_INSTRUCTION,
    'After Step 0, read /home/agent/AGENTS.md — it contains the architecture notes, suggested pages and components, design rules, and personalization instructions.',
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
    // Step 0: dev server. Front-loaded BEFORE any other instruction so the
    // agent's first action is "make the user see a preview ASAP".
    ENSURE_DEV_SERVER_INSTRUCTION,
    'After Step 0, read /home/agent/AGENTS.md if present — it contains the build plan and personalization instructions.',
    PERSONALIZATION_INSTRUCTION,
    'Make the minimum set of file edits needed to satisfy the user request.',
    'Do not spend time on broad repo exploration.',
    'If shadcn/ui components are available (src/components/ui/), use them instead of raw HTML.',
    'After writing UI code, screenshot the preview to verify it renders correctly. Fix any unstyled elements before responding.',
  ].join(' ')
}
