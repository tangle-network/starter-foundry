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
  'REQUIRED FIRST EDIT after Step 0: locate and rewrite personalize.json (in the workspace root or under src/, depending on family). It is the SINGLE SOURCE OF TRUTH for brand name, brand tagline, hero eyebrow, hero headline, hero subheadline, and (where present) feature names, pricing tiers, and footer content. The dev server templates the served HTML from this file at request time, so editing it makes the user\'s preview update on the next browser refresh — no restart, no build step. Replace the placeholder content ("Starter Foundry", "Acme", "Build something people want", "Lightning fast", etc.) with copy specific to the user\'s actual product. Keep the schema shape unchanged. This is the single highest-leverage edit you can make in turn 1; do it before writing any new files or features.'

/**
 * Combined personalization instruction. Use this when injecting scaffold
 * context unless you have a reason to use one mechanism but not the other.
 */
export const PERSONALIZATION_INSTRUCTION = `${PERSONALIZATION_JSON_INSTRUCTION} ${PERSONALIZATION_CSS_INSTRUCTION}`

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

// ── Structured context builders ──────────────────────────────────────────
//
// These replace the old .join(' ') wall-of-text format with numbered steps.
// LLMs follow numbered instructions more reliably than prose paragraphs,
// and the structured format cuts ~40% of tokens by removing redundancy
// between the context message and AGENTS.md.

const DEV_SERVER_STEP =
  '1. **Start the dev server** (do this FIRST, before reading files or editing):\n' +
  '   ```bash\n' +
  '   curl -fsS -X POST "http://localhost:${SIDECAR_PORT:-9000}/process/ensure-dev-server" \\\n' +
  '     -H "Content-Type: application/json" \\\n' +
  '     -H "Authorization: Bearer ${SIDECAR_AUTH_TOKEN}" -d \'{}\'\n' +
  '   ```\n' +
  '   Env vars are pre-set. Do NOT run pnpm/npm install or dev commands directly — they bypass runtime tracking.'

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
    DEV_SERVER_STEP,
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
    DEV_SERVER_STEP,
    PERSONALIZE_STEP,
    BUILD_STEP_CURATED,
    VERIFY_STEP,
  ].join('\n\n')
}
