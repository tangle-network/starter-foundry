import { emit, traced } from './telemetry.js'
import { loadRegistry } from './registry.js'
import { selectStarter } from './selection.js'
import { detectCapabilities, detectIndustry, detectLane, hasAny, matchesKeyword } from './keywords.js'
import { rewritePrompt, rewriteViaBrief } from './prompt-rewriter.js'
import type { ProductBrief } from './product-brief.js'
import type { Registry } from '../types.js'
import type { ComposeSpec, WorkspaceSpec, PromptPlan, ProjectEntry } from '../types.js'
import {
  API_SIGNALS,
  EXPLICIT_WORKER_SIGNALS,
  FRAMEWORK_API_TERMS,
  FRONTEND_SIGNALS,
  FULLSTACK_SIGNALS,
  REACT_FAMILIES,
  SINGLE_LANE_SIGNALS,
  STRONG_API_TERMS,
  WORKER_SIGNALS,
  WORKSPACE_SIGNALS,
} from './planner/signals.js'
import {
  detectAuthSlot,
  detectDatabaseSlot,
  detectEvmSupportApiPattern,
  detectHardhatExplicit,
  detectPaymentsSlot,
  detectQueueSlot,
  detectSdkSlot,
  detectSolanaProductApiPattern,
  detectSolanaWorkerPattern,
  detectTangleCustodyPattern,
  detectTangleOraclePattern,
  inferPartner,
  needsSupportApiLane,
} from './planner/detectors.js'
import {
  buildEvmContractLayers,
  buildEvmContractVariables,
  buildSolanaProgramLayers,
  buildSolanaProgramVariables,
} from './planner/contracts.js'
import { buildSlug, resolvePartnerForFamily } from './planner/helpers.js'
import { inferImplicitCapabilities } from './planner/implicit-caps.js'
import { buildApiProject, buildWebProject, buildWorkerProject, chooseApiFamily } from './planner/projects.js'

interface LaneDetection {
  frontend: boolean
  api: boolean
  worker: boolean
  evm: boolean
  solana: boolean
  move: boolean
  tangle: boolean
  avs: boolean
  stylus: boolean
  zk: boolean
  mcp: boolean
  dspy: boolean
  agent: boolean
  x402: boolean
  evmInfra: boolean
  implicitApi: boolean
  implicitWorker: boolean
}

function detectLanes(text: string, partner: string | null): LaneDetection {
  const hasApiRaw = hasAny(text, API_SIGNALS)
  const apiIsFalsePositive = hasApiRaw && !hasAny(text, STRONG_API_TERMS) && hasAny(text, FRAMEWORK_API_TERMS)
  const api = hasApiRaw && !apiIsFalsePositive

  const hasWorkerRaw = hasAny(text, WORKER_SIGNALS)
  const agentLane = detectLane(text, 'agent')
  const worker = hasWorkerRaw && (!agentLane || hasAny(text, EXPLICIT_WORKER_SIGNALS))

  const frontend = hasAny(text, FRONTEND_SIGNALS)
  const evm = detectLane(text, 'evm')
  const solana = hasAny(text, ['solana', 'anchor', 'pda'])
  const move = hasAny(text, ['move', 'aptos', 'sui'])
  const tangle = detectLane(text, 'tangle')
  const avs = detectLane(text, 'avs')
  const stylus = detectLane(text, 'stylus')
  const zk = detectLane(text, 'zk')
  const mcp = detectLane(text, 'mcp')
  const dspy = detectLane(text, 'dspy')
  const x402 = detectLane(text, 'x402')
  const evmInfra = detectLane(text, 'evm-infra')

  const hasProtocol = evm || solana || tangle || avs || stylus || evmInfra
  const commerceSupportApi =
    !api && frontend && needsSupportApiLane(text) &&
    (partner === 'coinbase' || detectPaymentsSlot(text) !== null || detectSdkSlot(text, partner) !== null) &&
    hasAny(text, ['api', 'backend', 'server', 'endpoint', 'webhook', 'order management', 'order history', 'payment webhook', 'indexer', 'transaction history'])
  const implicitApi =
    !api &&
    ((hasProtocol && (needsSupportApiLane(text) || detectEvmSupportApiPattern(text) || (solana && detectSolanaProductApiPattern(text)))) ||
      commerceSupportApi)
  const implicitWorker =
    !worker &&
    ((solana && detectSolanaWorkerPattern(text)) ||
      (evm && hasAny(text, ['keeper', 'bundler'])) ||
      (x402 && agentLane))

  return {
    frontend, api, worker, evm, solana, move, tangle, avs, stylus,
    zk, mcp, dspy, agent: agentLane, x402, evmInfra, implicitApi, implicitWorker,
  }
}

function shouldBeWorkspace(lanes: LaneDetection, text: string, partner: string | null): boolean {
  if (hasAny(text, SINGLE_LANE_SIGNALS)) return false

  const { frontend, api, worker, evm, solana, move, tangle, avs, stylus, zk, mcp, dspy, agent, x402, evmInfra, implicitApi, implicitWorker } = lanes
  const runtimeCount = [evm, solana, move].filter(Boolean).length
  const protocolLanes = [tangle, avs, stylus, zk, mcp, dspy, x402]

  // Plain agent/protocol without other surfaces → single starter
  const onlyAgent = agent && !frontend && !worker && !evm && !solana && !move && !protocolLanes.some(Boolean) && !evmInfra
  const onlyProtocol = !frontend && !api && !worker && !agent && protocolLanes.some(Boolean)
  if (onlyAgent || onlyProtocol) return false

  // Fullstack (frontend + api, no other lanes) → single fullstack-ts starter
  const noSpecialLanes = !worker && !evm && !solana && !move && !tangle && !avs && !stylus && !zk && !mcp && !dspy && !agent && !x402 && !evmInfra
  if (noSpecialLanes && frontend && api && !hasAny(text, WORKSPACE_SIGNALS) && hasAny(text, FULLSTACK_SIGNALS)) return false

  const laneCount = [frontend, api, worker, evm, solana, move, tangle, avs, stylus, zk, mcp, dspy, agent, x402, evmInfra, implicitApi].filter(Boolean).length
  const apiChoice = api ? chooseApiFamily(text) : null

  return (
    runtimeCount > 1 ||
    (frontend && runtimeCount > 0) ||
    (frontend && api) ||
    (worker && laneCount > 1) ||
    (frontend && protocolLanes.some(Boolean)) ||
    (frontend && agent) ||
    (frontend && api && apiChoice !== null && apiChoice.family !== 'api-service') ||
    (frontend && implicitApi) ||
    (implicitApi && (evm || solana || move || tangle || avs || stylus)) ||
    implicitWorker ||
    (hasAny(text, WORKSPACE_SIGNALS) && laneCount > 1)
  )
}

function buildProtocolProject(
  id: string, path: string, family: string, layers: string[],
  prompt: string, partner: string | null, variables: Record<string, string>,
): ProjectEntry {
  return {
    id, path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-${id}`,
      family, layers,
      partner: resolvePartnerForFamily(partner, family),
      slots: {},
      variables,
    },
  }
}

function collectProtocolProjects(lanes: LaneDetection, prompt: string, partner: string | null, text: string): ProjectEntry[] {
  const projects: ProjectEntry[] = []

  if (lanes.tangle) {
    const tangleLayers = ['framework:tangle-blueprint']
    if (detectTangleCustodyPattern(text)) tangleLayers.push('capability:tangle-custody')
    else if (detectTangleOraclePattern(text)) tangleLayers.push('capability:tangle-oracle')
    const profile = text.includes('custody')
      ? { blueprintName: 'custody-blueprint', jobName: 'ApproveTransaction' }
      : text.includes('oracle')
        ? { blueprintName: 'oracle-blueprint', jobName: 'UpdatePriceFeed' }
        : text.includes('zk')
          ? { blueprintName: 'zk-prover-blueprint', jobName: 'GenerateProof' }
          : { blueprintName: 'storage-blueprint', jobName: 'StoreObject' }
    projects.push(buildProtocolProject('tangle', 'protocols/tangle', 'tangle-blueprint', tangleLayers, prompt, partner, profile))
  }

  if (lanes.avs) {
    const avsName = text.includes('oracle') ? 'oracle-avs'
      : text.includes('keeper') ? 'keeper-avs'
      : text.includes('sequencer') ? 'sequencer-avs'
      : text.includes('bridge') ? 'bridge-avs'
      : 'data-availability-avs'
    projects.push(buildProtocolProject('avs', 'protocols/avs', 'eigenlayer-avs', ['framework:eigenlayer-avs'], prompt, partner, { avsName }))
  }

  if (lanes.stylus) {
    projects.push(buildProtocolProject('stylus', 'contracts/stylus', 'stylus-contracts', ['framework:stylus-contracts'], prompt, partner, { contractName: 'StylusPool' }))
  }

  if (lanes.evm) {
    const family = detectHardhatExplicit(text) ? 'hardhat-contracts' : 'forge-contracts'
    projects.push(buildProtocolProject('evm', 'contracts/evm', family, buildEvmContractLayers(text), prompt, partner, buildEvmContractVariables(text)))
  }

  if (lanes.solana) {
    projects.push(buildProtocolProject('solana', 'contracts/solana', 'solana-program', buildSolanaProgramLayers(text), prompt, partner, buildSolanaProgramVariables(text)))
  }

  if (lanes.move) {
    projects.push({ id: 'move', path: 'contracts/move', spec: { projectName: 'move_treasury', family: 'move-contracts', layers: ['framework:move-package'], partner: null, slots: {}, variables: { moduleName: 'TreasuryVault' } } })
  }

  return projects
}

function collectServiceProjects(lanes: LaneDetection, prompt: string, partner: string | null, text: string, registry: Registry): ProjectEntry[] {
  const projects: ProjectEntry[] = []

  if (lanes.mcp && !lanes.api) {
    projects.push(buildProtocolProject('mcp', 'apps/mcp', 'mcp-server-ts', ['framework:mcp-server-ts'], prompt, null, {}))
  }
  if (lanes.dspy && !lanes.api) {
    projects.push(buildProtocolProject('ai', 'apps/ai', 'dspy-pipeline-py', ['framework:dspy-pipeline-py'], prompt, null, {}))
  }
  if (lanes.x402 && !lanes.api) {
    projects.push({ id: 'api', path: 'apps/api', spec: { projectName: `${buildSlug(prompt, 'workspace')}-api`, family: 'x402-service', layers: ['framework:x402-service'], partner: resolvePartnerForFamily(partner, 'x402-service'), slots: {}, variables: {}, primaryArtifactTargetMs: 2500 } })
  }
  if (lanes.zk && !lanes.api) {
    const proofSystem = text.includes('circom') ? 'circom' : text.includes('fhenix') ? 'fhenix' : text.includes('risc zero') ? 'risc-zero' : 'sp1'
    projects.push(buildProtocolProject('zk', 'apps/prover', 'zk-prover-service', ['framework:zk-prover-service'], prompt, null, { proofSystem }))
  }
  if (lanes.agent && !projects.some((p) => p.id === 'agent')) {
    projects.push(buildApiProject(prompt, partner, text, registry))
  }

  return projects
}

function buildWorkspacePromptPlan({
  prompt,
  partner,
  text,
  registry,
}: {
  prompt: string
  partner: string | null
  text: string
  registry: Registry
}): PromptPlan | null {
  const lanes = detectLanes(text, partner)
  if (!shouldBeWorkspace(lanes, text, partner)) return null

  const projects: ProjectEntry[] = []
  if (lanes.frontend) projects.push(buildWebProject(prompt, partner, text, registry))
  if (lanes.api || lanes.implicitApi) projects.push(buildApiProject(prompt, partner, text, registry))
  if (lanes.worker || lanes.implicitWorker) projects.push(buildWorkerProject(prompt, partner, text))

  projects.push(...collectServiceProjects(lanes, prompt, partner, text, registry))
  projects.push(...collectProtocolProjects(lanes, prompt, partner, text))

  const runtimeCount = [lanes.evm, lanes.solana, lanes.move].filter(Boolean).length
  const primaryProjectId = projects.find((p) => p.id === 'web')?.id ?? projects[0]?.id ?? 'web'

  return {
    kind: 'workspace',
    confidence: runtimeCount > 1 ? 'high' : 'medium',
    reasons: ['multi-lane workspace prompt detected'],
    spec: {
      workspaceName: `${buildSlug(prompt, 'workspace')}-workspace`,
      userPrompt: prompt,
      launchPlan: {
        primaryProjectId,
        primaryArtifact: {
          kind: primaryProjectId === 'web' ? 'preview' : 'service',
          path: primaryProjectId === 'web' ? '/' : '/health',
          targetMs: 2500,
        },
        initialAgentMission:
          "Build the user's prompt on top of this prepared workspace. Start with the primary product surface, then extend the surrounding lanes.",
      },
      projects,
    },
  }
}

export async function planPrompt({
  prompt,
  partner = null,
  forceKind = null,
  familyHint = null,
  rewriter = false,
  brief = false,
}: {
  prompt: string
  partner?: string | null
  /** Force the result to be 'starter' or 'workspace'. Used by scaffold-builder for curated templates. */
  forceKind?: 'starter' | 'workspace' | null
  /** Hint the family directly. Skips family scoring, only detects capabilities + slots. */
  familyHint?: string | null
  /** Narrow rewriter: LLM produces a short canonical prompt for re-planning. Back-compat flag; prefer `brief`. */
  rewriter?: boolean
  /** Rich product brief: one LLM call produces canonical prompt + vision + tasks + milestones + tests + e2e + security + openQuestions. Attached to the returned plan via .brief for downstream context-pack use. */
  brief?: boolean
}): Promise<PromptPlan> {
  if (brief) {
    const preCheck = await selectStarter({ prompt, partner })
    if (preCheck.confidence !== 'high' || preCheck.fallbackUsed) {
      const registry = await loadRegistry()
      const knownFamilies = [...registry.families.keys()]
      const knownCapabilities: string[] = []
      for (const [key] of registry.layers) {
        if (key.startsWith('capability:')) knownCapabilities.push(key)
      }
      const briefResult = await rewriteViaBrief({ prompt, partner, knownFamilies, knownCapabilities })
      if (briefResult) {
        const plan = await planPrompt({
          prompt: briefResult.canonicalPrompt,
          partner,
          forceKind,
          familyHint,
          rewriter: false,
          brief: false,
        })
        return { ...plan, brief: briefResult.brief as ProductBrief }
      }
    }
  }

  if (rewriter) {
    const preCheck = await selectStarter({ prompt, partner })
    if (preCheck.confidence !== 'high' || preCheck.fallbackUsed) {
      const registry = await loadRegistry()
      const knownFamilies = [...registry.families.keys()]
      const knownCapabilities: string[] = []
      for (const [key] of registry.layers) {
        if (key.startsWith('capability:')) knownCapabilities.push(key)
      }
      const rewrite = await rewritePrompt({ prompt, partner, knownFamilies, knownCapabilities })
      if (rewrite) {
        return planPrompt({ prompt: rewrite.canonicalPrompt, partner, forceKind, familyHint, rewriter: false })
      }
    }
  }

  const { result: plan, durationMs } = await traced('planPrompt', async () => {
    const text = prompt.toLowerCase()
    const effectivePartner = partner ?? inferPartner(text)
    const registry = await loadRegistry()

    // Skip workspace detection when caller knows this is a single project
    if (forceKind !== 'starter') {
      const workspacePlan = buildWorkspacePromptPlan({ prompt, partner: effectivePartner, text, registry })
      if (workspacePlan) {
        return workspacePlan
      }
    }

    // Use family hint if provided (scaffold-builder knows the family)
    let starterSelection: Awaited<ReturnType<typeof selectStarter>>
    if (familyHint && registry.families.has(familyHint)) {
      const fwLayers: string[] = []
      for (const [key, layer] of registry.layers) {
        if (layer.group === 'framework' && layer.appliesTo?.includes(familyHint)) {
          fwLayers.push(key)
        }
      }
      starterSelection = {
        confidence: 'high',
        spec: {
          projectName: partner ? `${partner}-starter` : 'generated-starter',
          family: familyHint,
          layers: fwLayers,
          partner: effectivePartner,
          slots: {},
          variables: {},
        },
        fallbackUsed: false,
        reasons: [`family hint: ${familyHint}`],
      }
    } else {
      starterSelection = await selectStarter({ prompt, partner: effectivePartner })
    }
    const family = registry.families.get(starterSelection.spec.family)
    const spec: ComposeSpec = {
      ...starterSelection.spec,
      // Scrub partner if it's incompatible with the selected family — otherwise
      // composeStarter throws at compose time, after the caller has already
      // allocated a workspace and shown the user a "preparing" UI (blueprint-
      // agent bug report #3).
      partner: resolvePartnerForFamily(starterSelection.spec.partner ?? effectivePartner, starterSelection.spec.family),
      projectName: buildSlug(prompt, starterSelection.spec.projectName),
      primaryArtifactTargetMs: 2500,
      userPrompt: prompt,
    }

    const databaseSlot = detectDatabaseSlot(text)
    const sdkSlot = detectSdkSlot(text, effectivePartner)
    const authSlot = detectAuthSlot(text)
    const paymentsSlot = detectPaymentsSlot(text)
    const queueSlot = detectQueueSlot(text)
    spec.slots = { ...(spec.slots ?? {}) }

    if (databaseSlot && family?.slots?.['database']) spec.slots['database'] = databaseSlot
    if (sdkSlot && family?.slots?.['sdk']) spec.slots['sdk'] = sdkSlot
    if (authSlot && family?.slots?.['auth']) spec.slots['auth'] = authSlot
    if (paymentsSlot && family?.slots?.['payments']) spec.slots['payments'] = paymentsSlot
    if (queueSlot && family?.slots?.['queue']) spec.slots['queue'] = queueSlot

    const capabilities = detectCapabilities(text, spec.family, registry)
    if (capabilities.length > 0) {
      spec.layers = [...new Set([...(spec.layers ?? []), ...capabilities])]
    }

    const industry = detectIndustry(text, spec.family, registry)
    if (industry) {
      spec.layers = [...new Set([...(spec.layers ?? []), industry])]
    }
    // Frontend families default to tailwind + shadcn so the layout layers and
    // any UI components composed downstream actually render with styles.
    // Without these, components ship Tailwind class names against an unconfigured
    // Tailwind install — the visual result is unstyled HTML.
    if (REACT_FAMILIES.has(spec.family)) {
      const layerSet = new Set(spec.layers ?? [])
      if (!layerSet.has('capability:tailwind')) {
        spec.layers = [...(spec.layers ?? []), 'capability:tailwind']
      }
      if (!layerSet.has('capability:shadcn')) {
        spec.layers = [...(spec.layers ?? []), 'capability:shadcn']
      }
    }

    // Archetype-based implicit capability inference. Runs last so it can see
    // everything already attached and avoid double-adding. For web-producing
    // families this attaches the SaaS UI trio (layout-dashboard + chart +
    // ai-chat-ui) or the chat archetype (layout-chat + ai-chat-ui) based on
    // the product shape in the prompt.
    const implicitCaps = inferImplicitCapabilities(text, spec.family, new Set(spec.layers ?? []))
    if (implicitCaps.length > 0) {
      spec.layers = [...new Set([...(spec.layers ?? []), ...implicitCaps])]
    }

    return {
      kind: 'starter' as const,
      confidence: starterSelection.confidence,
      reasons: starterSelection.reasons,
      spec,
    }
  })

  const family = plan.kind === 'starter' ? plan.spec.family : plan.spec.projects?.[0]?.spec.family ?? 'unknown'
  const capabilities = plan.kind === 'starter'
    ? (plan.spec.layers ?? []).filter((l: string) => l.startsWith('capability:'))
    : plan.spec.projects?.flatMap((p: { spec: { layers?: string[] } }) => (p.spec.layers ?? []).filter((l: string) => l.startsWith('capability:'))) ?? []

  emit('route', {
    prompt,
    kind: plan.kind,
    family,
    confidence: plan.confidence,
    capabilities,
    fallbackUsed: false,
    durationMs,
  })

  return plan
}
