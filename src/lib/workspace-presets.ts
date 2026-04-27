// Workspace preset registry + dispatcher for `workspace-compose --preset <id>`.
//
// A preset is a recipe that says "compose these N family bundles into a
// pnpm workspace, wire env between them, expose top-level scripts, and emit
// a CI workflow." Presets exist so users can request canonical Tangle agent
// stacks (app + agent + eval[+research]) as one flag instead of authoring a
// multi-project WorkspaceSpec by hand.
//
// The preset itself only declares slots (which family role lands where) and
// wiring rules. Resolving slot → concrete family ID is the caller's job
// (CLI flags `--app <id> --agent <id>` etc.). The dispatcher in this module
// validates the user's choices against the preset's `choose` constraints,
// expands them into a WorkspaceSpec, runs `composeWorkspace`, then writes
// the workspace-level scaffolding (root package.json, pnpm-workspace.yaml,
// per-bundle .env files, CI workflow, README).
//
// See `tests/workspace-preset.test.ts` for the regression contract.

import fs from 'node:fs/promises'
import path from 'node:path'

import { type FamilyId, familyId } from '../types/ids.js'
import type { ComposeSpec, WorkspaceSpec } from '../types.js'

import { ensureDir, sanitizePackageName } from './fs.js'
import { composeWorkspace, type ComposeWorkspaceResult } from './workspace.js'

/**
 * One slot inside a preset — the role a family bundle plays in the
 * workspace. `id` is the slot name (e.g. `'app-shell'`); `choose` is the
 * set of family IDs (or glob patterns ending in `-*-ts`) that may fill it.
 *
 * The slot ID is what users reference when overriding a choice via CLI
 * (`--<slotId> <familyId>`). The dispatcher validates the override against
 * `choose` before composing.
 */
export interface WorkspacePresetSlot {
  /** Slot name — kebab-case, doubles as the directory name in the workspace. */
  id: string
  /** Whether the slot must be filled. Optional slots may be omitted. */
  required: boolean
  /**
   * Allowed family IDs. Each entry is either an exact family ID or a glob
   * suffix `<prefix>-*-ts` matching any family whose ID starts with
   * `<prefix>-` and ends with `-ts`. The dispatcher resolves globs against
   * the set of family IDs the user supplies; it does NOT enumerate the
   * registry (that would couple the preset registry to disk state).
   */
  choose: string[]
  /**
   * Default family ID if the user does not override. Must satisfy `choose`.
   * Optional — when absent, the slot has no default and the user must
   * supply one.
   */
  default?: string
  /**
   * Layers to attach to whichever family lands here. Forwarded into the
   * generated `ComposeSpec.layers`.
   */
  layers?: string[]
}

/**
 * One env-wiring edge — `from` slot exposes a variable, `to` slot reads it
 * under (possibly different) name `toVar`. The dispatcher emits each
 * receiving slot's `.env` with all incoming wires populated by placeholder
 * values; the user replaces them once the from-side is running.
 *
 * Example: `{ from: 'agent', var: 'AGENT_ENDPOINT', to: 'app',
 * toVar: 'VITE_AGENT_ENDPOINT' }` → `app/.env` gets
 * `VITE_AGENT_ENDPOINT=http://localhost:3001` (placeholder).
 */
export interface WorkspaceEnvWire {
  from: string
  var: string
  to: string
  toVar: string
  /** Optional placeholder value written into the receiving `.env`. */
  placeholder?: string
}

/**
 * Top-level scripts injected into the workspace root `package.json`.
 * Keys map to npm script names; values are pnpm/shell commands. Always
 * pnpm-style — pnpm is the workspace runner.
 */
export type WorkspaceTopLevelScripts = Record<string, string>

export interface WorkspacePreset {
  id: string
  description: string
  slots: WorkspacePresetSlot[]
  envWiring: WorkspaceEnvWire[]
  topLevelScripts: WorkspaceTopLevelScripts
  /**
   * GitHub Actions job steps (after `pnpm install` + `pnpm build`) — each
   * entry becomes one `run:` step in `.github/workflows/ci.yml`. Keep it
   * to script names, not raw shell, so the CI mirrors `topLevelScripts`.
   */
  ciSteps: string[]
}

/**
 * Canonical Tangle agent-stack presets. Order is meaningful — first preset
 * is the suggested default for `--preset` when users don't specify.
 */
export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  {
    id: 'app+agent+eval',
    description:
      'App shell + agent runtime + eval harness. Three pnpm packages with env wired so the app talks to the agent and the eval harness benchmarks the agent.',
    slots: [
      {
        id: 'app',
        required: true,
        choose: ['agent-with-ui-ts', 'sandbox-app-ts', 'orchestrator-with-ui-ts'],
        default: 'agent-with-ui-ts',
      },
      {
        id: 'agent',
        required: true,
        choose: ['agent-runtime-*-ts'],
      },
      {
        id: 'eval',
        required: true,
        choose: ['agent-eval-harness-ts'],
        default: 'agent-eval-harness-ts',
      },
    ],
    envWiring: [
      {
        from: 'agent',
        var: 'AGENT_ENDPOINT',
        to: 'app',
        toVar: 'VITE_AGENT_ENDPOINT',
        placeholder: 'http://localhost:3001',
      },
      {
        from: 'agent',
        var: 'AGENT_ENDPOINT',
        to: 'eval',
        toVar: 'EVAL_TARGET_URL',
        placeholder: 'http://localhost:3001',
      },
    ],
    topLevelScripts: {
      dev: 'pnpm -r --parallel dev',
      build: 'pnpm -r build',
      eval: 'pnpm --filter ./eval run eval',
      test: 'pnpm -r test',
    },
    ciSteps: ['pnpm build', 'pnpm eval'],
  },
  {
    id: 'app+agent+eval+research',
    description:
      'App shell + agent runtime + eval harness + research harness. Adds a research bundle that observes the agent + eval surface to drive hypothesis-experiment loops.',
    slots: [
      {
        id: 'app',
        required: true,
        choose: ['agent-with-ui-ts', 'sandbox-app-ts', 'orchestrator-with-ui-ts'],
        default: 'agent-with-ui-ts',
      },
      {
        id: 'agent',
        required: true,
        choose: ['agent-runtime-*-ts'],
      },
      {
        id: 'eval',
        required: true,
        choose: ['agent-eval-harness-ts'],
        default: 'agent-eval-harness-ts',
      },
      {
        id: 'research',
        required: true,
        choose: ['agent-research-harness-ts'],
        default: 'agent-research-harness-ts',
      },
    ],
    envWiring: [
      {
        from: 'agent',
        var: 'AGENT_ENDPOINT',
        to: 'app',
        toVar: 'VITE_AGENT_ENDPOINT',
        placeholder: 'http://localhost:3001',
      },
      {
        from: 'agent',
        var: 'AGENT_ENDPOINT',
        to: 'eval',
        toVar: 'EVAL_TARGET_URL',
        placeholder: 'http://localhost:3001',
      },
      {
        from: 'agent',
        var: 'AGENT_ENDPOINT',
        to: 'research',
        toVar: 'RESEARCH_TARGET_URL',
        placeholder: 'http://localhost:3001',
      },
      {
        from: 'eval',
        var: 'EVAL_RESULTS_DIR',
        to: 'research',
        toVar: 'RESEARCH_EVAL_INPUT_DIR',
        placeholder: '../eval/.eval-runs',
      },
    ],
    topLevelScripts: {
      dev: 'pnpm -r --parallel dev',
      build: 'pnpm -r build',
      eval: 'pnpm --filter ./eval run eval',
      research: 'pnpm --filter ./research run research',
      test: 'pnpm -r test',
    },
    ciSteps: ['pnpm build', 'pnpm eval', 'pnpm research'],
  },
]

export function listWorkspacePresets(): WorkspacePreset[] {
  return WORKSPACE_PRESETS.slice()
}

export function getWorkspacePreset(id: string): WorkspacePreset {
  const found = WORKSPACE_PRESETS.find((preset) => preset.id === id)
  if (!found) {
    const known = WORKSPACE_PRESETS.map((p) => p.id).join(', ')
    throw new Error(`Unknown workspace preset "${id}". Known presets: ${known}`)
  }
  return found
}

/** Slot ID → user-supplied family ID. */
export type WorkspacePresetChoices = Record<string, FamilyId>

function matchesChoose(family: FamilyId, choose: string[]): boolean {
  for (const candidate of choose) {
    if (candidate === family) return true
    if (candidate.endsWith('-*-ts')) {
      const prefix = candidate.slice(0, -'-*-ts'.length) + '-'
      if (family.startsWith(prefix) && family.endsWith('-ts')) return true
    }
  }
  return false
}

/**
 * Resolve user choices against a preset, applying defaults and validating
 * each filled slot against its `choose` constraint. Throws on missing
 * required slot or invalid family ID.
 */
export function resolvePresetChoices(
  preset: WorkspacePreset,
  raw: Record<string, string>,
): WorkspacePresetChoices {
  const out: WorkspacePresetChoices = {}
  for (const slot of preset.slots) {
    const provided = raw[slot.id]
    const value = provided ?? slot.default
    if (!value) {
      if (slot.required) {
        throw new Error(
          `Preset "${preset.id}" requires slot "${slot.id}". Pass --${slot.id} <family-id>.`,
        )
      }
      continue
    }
    const fid = familyId(value)
    if (!matchesChoose(fid, slot.choose)) {
      throw new Error(
        `Preset "${preset.id}" slot "${slot.id}" does not accept family "${value}". ` +
          `Allowed: ${slot.choose.join(', ')}.`,
      )
    }
    out[slot.id] = fid
  }
  return out
}

/**
 * Translate resolved choices into a WorkspaceSpec the existing
 * `composeWorkspace` engine can consume. Each slot becomes one project
 * whose `path` is the slot ID (kebab-case dir at workspace root).
 */
export function buildWorkspaceSpecFromPreset({
  preset,
  choices,
  workspaceName,
  userPrompt,
}: {
  preset: WorkspacePreset
  choices: WorkspacePresetChoices
  workspaceName: string
  userPrompt?: string
}): WorkspaceSpec {
  const projects = preset.slots
    .filter((slot) => choices[slot.id] !== undefined)
    .map((slot) => {
      const family = choices[slot.id]
      const projectName = sanitizePackageName(`${workspaceName}-${slot.id}`)
      const spec: ComposeSpec = {
        projectName,
        family,
        layers: slot.layers ?? [],
        partner: null,
        slots: {},
        variables: {},
      }
      return { id: slot.id, path: slot.id, spec }
    })

  const primaryProjectId = preset.slots.find((s) => s.id === 'app')?.id ?? projects[0]?.id ?? 'app'

  const spec: WorkspaceSpec = {
    workspaceName,
    projects,
    launchPlan: {
      primaryProjectId,
      primaryArtifact: { kind: 'preview', path: '/', targetMs: 3000 },
      initialAgentMission: `Run \`pnpm dev\` from the workspace root, then read each bundle's AGENTS.md before editing.`,
    },
  }
  if (userPrompt) spec.userPrompt = userPrompt
  return spec
}

// ── Workspace-level scaffolding writers ─────────────────────────────────

export function buildRootPackageJson(
  workspaceName: string,
  scripts: WorkspaceTopLevelScripts,
): Record<string, unknown> {
  return {
    name: sanitizePackageName(workspaceName),
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts,
    packageManager: 'pnpm@9.0.0',
  }
}

export function buildPnpmWorkspaceYaml(slotIds: string[]): string {
  const lines = ['packages:']
  for (const id of slotIds) lines.push(`  - '${id}'`)
  return lines.join('\n') + '\n'
}

export function buildEnvFileForSlot(slotId: string, wires: WorkspaceEnvWire[]): string {
  const incoming = wires.filter((wire) => wire.to === slotId)
  if (incoming.length === 0) return ''
  const lines = [
    `# Auto-generated by workspace-compose --preset.`,
    `# Wires populated from sibling bundles. Replace placeholders with real URLs once each bundle is running.`,
    '',
  ]
  for (const wire of incoming) {
    lines.push(`# from ${wire.from}.${wire.var}`)
    lines.push(`${wire.toVar}=${wire.placeholder ?? ''}`)
  }
  return lines.join('\n') + '\n'
}

export function buildCiYaml(ciSteps: string[]): string {
  const lines = [
    'name: ci',
    '',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: pnpm/action-setup@v4',
    '        with:',
    "          version: '9'",
    '      - uses: actions/setup-node@v4',
    '        with:',
    "          node-version: '20'",
    "          cache: 'pnpm'",
    '      - run: pnpm install --frozen-lockfile',
  ]
  for (const step of ciSteps) {
    lines.push(`      - run: ${step}`)
  }
  return lines.join('\n') + '\n'
}

export function buildPresetReadme(
  preset: WorkspacePreset,
  workspaceName: string,
  choices: WorkspacePresetChoices,
): string {
  const lines = [
    `# ${workspaceName}`,
    '',
    `Generated by \`starter-foundry workspace-compose --preset ${preset.id}\`.`,
    '',
    `> ${preset.description}`,
    '',
    '## Bundles',
    '',
  ]
  for (const slot of preset.slots) {
    const family = choices[slot.id]
    if (!family) continue
    lines.push(`- \`${slot.id}/\` — ${family}`)
  }
  lines.push('', '## Scripts', '')
  for (const [name, cmd] of Object.entries(preset.topLevelScripts)) {
    lines.push(`- \`pnpm ${name}\` → \`${cmd}\``)
  }
  lines.push(
    '',
    '## Env wiring',
    '',
    'Each bundle has its own `.env` populated with placeholder URLs for sibling bundles.',
    'Update them once each service is running locally:',
    '',
  )
  for (const wire of preset.envWiring) {
    lines.push(
      `- \`${wire.to}/.env\` reads \`${wire.toVar}\` from \`${wire.from}\` (\`${wire.var}\`)`,
    )
  }
  lines.push(
    '',
    '## Next steps',
    '',
    '1. `pnpm install`',
    '2. `pnpm dev` — launches every bundle in parallel',
    "3. Open each bundle's `AGENTS.md` to see the per-runtime build instructions",
    '',
  )
  return lines.join('\n')
}

// ── Public dispatcher ───────────────────────────────────────────────────

export interface ComposePresetWorkspaceResult extends ComposeWorkspaceResult {
  presetId: string
  rootPackageJsonPath: string
  pnpmWorkspaceYamlPath: string
  ciWorkflowPath: string
  readmePath: string
  envFilesWritten: string[]
}

/**
 * Compose a preset-driven workspace. Drives `composeWorkspace` for the
 * per-bundle scaffolding, then writes the workspace-level files (root
 * package.json, pnpm-workspace.yaml, per-bundle .env, CI workflow, README).
 */
export async function composePresetWorkspace({
  presetId,
  choices,
  workspaceName,
  userPrompt,
  outDir,
}: {
  presetId: string
  choices: Record<string, string>
  workspaceName: string
  userPrompt?: string
  outDir: string
}): Promise<ComposePresetWorkspaceResult> {
  const preset = getWorkspacePreset(presetId)
  const resolved = resolvePresetChoices(preset, choices)
  const spec = buildWorkspaceSpecFromPreset({
    preset,
    choices: resolved,
    workspaceName,
    userPrompt,
  })

  const result = await composeWorkspace({ spec, outDir })

  // Root package.json
  const rootPkg = buildRootPackageJson(workspaceName, preset.topLevelScripts)
  const rootPackageJsonPath = path.join(outDir, 'package.json')
  await fs.writeFile(rootPackageJsonPath, `${JSON.stringify(rootPkg, null, 2)}\n`, 'utf8')

  // pnpm-workspace.yaml
  const slotIds = preset.slots.filter((s) => resolved[s.id]).map((s) => s.id)
  const pnpmWorkspaceYamlPath = path.join(outDir, 'pnpm-workspace.yaml')
  await fs.writeFile(pnpmWorkspaceYamlPath, buildPnpmWorkspaceYaml(slotIds), 'utf8')

  // Per-bundle .env files
  const envFilesWritten: string[] = []
  for (const slotId of slotIds) {
    const envBody = buildEnvFileForSlot(slotId, preset.envWiring)
    if (!envBody) continue
    const envPath = path.join(outDir, slotId, '.env')
    await ensureDir(path.dirname(envPath))
    await fs.writeFile(envPath, envBody, 'utf8')
    envFilesWritten.push(envPath)
  }

  // CI workflow
  const ciWorkflowPath = path.join(outDir, '.github', 'workflows', 'ci.yml')
  await ensureDir(path.dirname(ciWorkflowPath))
  await fs.writeFile(ciWorkflowPath, buildCiYaml(preset.ciSteps), 'utf8')

  // README
  const readmePath = path.join(outDir, 'README.md')
  await fs.writeFile(readmePath, buildPresetReadme(preset, workspaceName, resolved), 'utf8')

  return {
    ...result,
    presetId,
    rootPackageJsonPath,
    pnpmWorkspaceYamlPath,
    ciWorkflowPath,
    readmePath,
    envFilesWritten,
  }
}
