import type { FamilyManifest, Registry, TaxonomyFields } from '../types.js'
import type { ComposeSpec, WorkspaceSpec, PromptPlan, ProjectEntry } from '../types.js'

import { detectDomainPackAmbiguity, scoreDomainPackFamilies } from './domain-packs.js'
import {
  detectCapabilities,
  detectIndustry,
  detectLane,
  hasAny,
  matchesKeyword,
} from './keywords.js'
import {
  buildEvmContractLayers,
  buildEvmContractVariables,
  buildSolanaProgramLayers,
  buildSolanaProgramVariables,
} from './planner/contracts.js'
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
import { hasEvmDomainPackSupportApiSurface } from './planner/domain-pack-signals.js'
import { buildSlug, resolvePartnerForFamily } from './planner/helpers.js'
import { inferImplicitCapabilities } from './planner/implicit-caps.js'
import { shouldPromotePartnerFirst } from './planner/partner-first.js'
import {
  buildApiProject,
  buildWebProject,
  buildWorkerProject,
  chooseApiFamily,
} from './planner/projects.js'
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
import type { ProductBrief } from './product-brief.js'
import { rewritePrompt, rewriteViaBrief } from './prompt-rewriter.js'
import { loadRegistry } from './registry.js'
import { selectStarter } from './selection.js'
import { emit, traced } from './telemetry.js'

interface LaneDetection {
  frontend: boolean
  api: boolean
  worker: boolean
  evm: boolean
  solana: boolean
  move: boolean
  tangle: boolean
  avs: boolean
  domainContract: boolean
  zk: boolean
  mcp: boolean
  dspy: boolean
  agent: boolean
  x402: boolean
  evmInfra: boolean
  implicitApi: boolean
  implicitWorker: boolean
}

interface DomainContractChoice {
  family: string
  layers: string[]
  taxonomy?: TaxonomyFields
}

interface DomainContractOptions {
  includeLayerMatches?: boolean
}

const CONTRACT_SURFACE_SIGNALS = [
  'contract',
  'contracts',
  'smart contract',
  'solidity',
  'foundry',
  'foundry.toml',
  'forge',
  'forge test',
  'hardhat',
  'token contract',
  'erc20',
  'erc-20',
  'erc721',
  'erc-721',
]

const NON_CONTRACT_SURFACE_SIGNALS = [
  ...FRONTEND_SIGNALS,
  ...API_SIGNALS,
  ...WORKER_SIGNALS,
  ...FRAMEWORK_API_TERMS,
]

function hasContractSurfaceIntent(text: string): boolean {
  return hasAny(text, CONTRACT_SURFACE_SIGNALS)
}

function hasCompetingNonContractSurfaceIntent(text: string): boolean {
  return hasAny(text, NON_CONTRACT_SURFACE_SIGNALS)
}

function hasDomainAuthenticityEvidence(match: { reasons: string[] }): boolean {
  return match.reasons.some((reason) => reason.startsWith('authenticity-signals:'))
}

function layerContractMatchIsSpecificEnough(
  text: string,
  match: { layers?: string[]; reasons: string[] },
): boolean {
  if (!match.layers?.length) return true
  if (hasContractSurfaceIntent(text)) return true
  if (hasCompetingNonContractSurfaceIntent(text)) return false
  return hasDomainAuthenticityEvidence(match)
}

function detectLanes(
  prompt: string,
  text: string,
  partner: string | null,
  registry: Registry,
): LaneDetection {
  const hasApiRaw = hasAny(text, API_SIGNALS)
  const apiIsFalsePositive =
    hasApiRaw && !hasAny(text, STRONG_API_TERMS) && hasAny(text, FRAMEWORK_API_TERMS)
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
  const domainContract =
    selectDomainContractFamily(prompt, partner, registry, { includeLayerMatches: true }) !== null
  const zk = detectLane(text, 'zk')
  const mcp = detectLane(text, 'mcp')
  const dspy = detectLane(text, 'dspy')
  const x402 = detectLane(text, 'x402')
  const evmInfra = detectLane(text, 'evm-infra')
  const domainPackSupportApi = hasEvmDomainPackSupportApiSurface({ prompt, partner, registry })

  const hasProtocol = evm || solana || tangle || avs || domainContract || evmInfra
  const commerceSupportApi =
    !api &&
    frontend &&
    needsSupportApiLane(text) &&
    (partner === 'coinbase' ||
      detectPaymentsSlot(text) !== null ||
      detectSdkSlot(text, partner) !== null) &&
    hasAny(text, [
      'api',
      'backend',
      'server',
      'endpoint',
      'webhook',
      'order management',
      'order history',
      'payment webhook',
      'indexer',
      'transaction history',
    ])
  const implicitApi =
    !api &&
    ((hasProtocol &&
      (needsSupportApiLane(text) ||
        detectEvmSupportApiPattern(text) ||
        domainPackSupportApi ||
        (solana && detectSolanaProductApiPattern(text)))) ||
      commerceSupportApi)
  const implicitWorker =
    !worker &&
    ((solana && detectSolanaWorkerPattern(text)) ||
      (evm && hasAny(text, ['keeper', 'bundler'])) ||
      (x402 && agentLane))

  return {
    frontend,
    api,
    worker,
    evm,
    solana,
    move,
    tangle,
    avs,
    domainContract,
    zk,
    mcp,
    dspy,
    agent: agentLane,
    x402,
    evmInfra,
    implicitApi,
    implicitWorker,
  }
}

function shouldBeWorkspace(lanes: LaneDetection, text: string, partner: string | null): boolean {
  if (hasAny(text, SINGLE_LANE_SIGNALS)) return false

  const {
    frontend,
    api,
    worker,
    evm,
    solana,
    move,
    tangle,
    avs,
    domainContract,
    zk,
    mcp,
    dspy,
    agent,
    x402,
    evmInfra,
    implicitApi,
    implicitWorker,
  } = lanes
  const runtimeCount = [evm, solana, move].filter(Boolean).length
  const protocolLanes = [tangle, avs, domainContract, zk, mcp, dspy, x402]

  // Plain agent/protocol without other surfaces → single starter
  const onlyAgent =
    agent &&
    !frontend &&
    !worker &&
    !evm &&
    !solana &&
    !move &&
    !protocolLanes.some(Boolean) &&
    !evmInfra
  const onlyProtocol = !frontend && !api && !worker && !agent && protocolLanes.some(Boolean)
  if (onlyAgent || onlyProtocol) return false

  // Fullstack (frontend + api, no other lanes) → single fullstack-ts starter
  const noSpecialLanes =
    !worker &&
    !evm &&
    !solana &&
    !move &&
    !tangle &&
    !avs &&
    !domainContract &&
    !zk &&
    !mcp &&
    !dspy &&
    !agent &&
    !x402 &&
    !evmInfra
  if (
    noSpecialLanes &&
    frontend &&
    api &&
    !hasAny(text, WORKSPACE_SIGNALS) &&
    hasAny(text, FULLSTACK_SIGNALS)
  )
    return false

  const laneCount = [
    frontend,
    api,
    worker,
    evm,
    solana,
    move,
    tangle,
    avs,
    domainContract,
    zk,
    mcp,
    dspy,
    agent,
    x402,
    evmInfra,
    implicitApi,
  ].filter(Boolean).length
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
    (implicitApi && (evm || solana || move || tangle || avs || domainContract)) ||
    implicitWorker ||
    (hasAny(text, WORKSPACE_SIGNALS) && laneCount > 1)
  )
}

function buildProtocolProject(
  id: string,
  path: string,
  family: string,
  layers: string[],
  prompt: string,
  partner: string | null,
  variables: Record<string, string>,
): ProjectEntry {
  return {
    id,
    path,
    spec: {
      projectName: `${buildSlug(prompt, 'workspace')}-${id}`,
      family,
      layers,
      partner: resolvePartnerForFamily(partner, family),
      slots: {},
      variables,
    },
  }
}

function frameworkLayersForFamily(registry: Registry, familyId: string): string[] {
  const layers: string[] = []
  for (const [key, layer] of registry.layers) {
    if (layer.group === 'framework' && layer.appliesTo?.includes(familyId)) layers.push(key)
  }
  return layers
}

function selectDomainContractFamily(
  prompt: string,
  partner: string | null,
  registry: Registry,
  options: DomainContractOptions = {},
): DomainContractChoice | null {
  const text = prompt.toLowerCase()
  const includeLayerMatches = options.includeLayerMatches ?? true
  const hardhatExplicit = detectHardhatExplicit(text)
  const matches = scoreDomainPackFamilies({ prompt, partner, registry })
  const ambiguity = detectDomainPackAmbiguity(matches)
  for (const match of matches) {
    if (!includeLayerMatches && match.layers?.length) continue
    if (ambiguity?.families.includes(match.family)) continue
    const family = registry.families.get(match.family)
    if (family?.taxonomy?.surface !== 'contracts') continue
    if (!layerContractMatchIsSpecificEnough(text, match)) continue
    const runtime = family.domainPack?.domain.runtime ?? family.taxonomy.runtime
    if (hardhatExplicit && runtime !== 'hardhat') continue
    const layers = [
      ...new Set([...frameworkLayersForFamily(registry, match.family), ...(match.layers ?? [])]),
    ]
    return { family: match.family, layers, taxonomy: family.taxonomy }
  }
  return null
}

function contractProjectIdentity(
  choice: DomainContractChoice | null,
  family: FamilyManifest,
): {
  id: string
  path: string
} {
  if (family.taxonomy?.language === 'solidity') return { id: 'evm', path: 'contracts/evm' }

  const id =
    (
      choice?.taxonomy?.runtime ??
      choice?.taxonomy?.language ??
      family.taxonomy?.runtime ??
      'contract'
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'contract'
  return { id, path: `contracts/${id}` }
}

function collectProtocolProjects(
  lanes: LaneDetection,
  prompt: string,
  partner: string | null,
  text: string,
  registry: Registry,
): ProjectEntry[] {
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
    projects.push(
      buildProtocolProject(
        'tangle',
        'protocols/tangle',
        'tangle-blueprint',
        tangleLayers,
        prompt,
        partner,
        profile,
      ),
    )
  }

  if (lanes.avs) {
    const avsName = text.includes('oracle')
      ? 'oracle-avs'
      : text.includes('keeper')
        ? 'keeper-avs'
        : text.includes('sequencer')
          ? 'sequencer-avs'
          : text.includes('bridge')
            ? 'bridge-avs'
            : 'data-availability-avs'
    projects.push(
      buildProtocolProject(
        'avs',
        'protocols/avs',
        'eigenlayer-avs',
        ['framework:eigenlayer-avs'],
        prompt,
        partner,
        { avsName },
      ),
    )
  }

  if (lanes.evm || lanes.domainContract) {
    const domainContract = selectDomainContractFamily(prompt, partner, registry)
    const family =
      domainContract?.family ??
      (detectHardhatExplicit(text) ? 'hardhat-contracts' : 'forge-contracts')
    const familyManifest = registry.families.get(family)
    if (familyManifest) {
      const layers = domainContract?.layers ?? buildEvmContractLayers(text)
      const variables = buildEvmContractVariables(text)
      if (domainContract && variables.contractName === 'Counter') {
        delete variables.contractName
      }
      const identity = contractProjectIdentity(domainContract, familyManifest)
      projects.push(
        buildProtocolProject(
          identity.id,
          identity.path,
          family,
          layers,
          prompt,
          partner,
          variables,
        ),
      )
    }
  }

  if (lanes.solana) {
    projects.push(
      buildProtocolProject(
        'solana',
        'contracts/solana',
        'solana-program',
        buildSolanaProgramLayers(text),
        prompt,
        partner,
        buildSolanaProgramVariables(text),
      ),
    )
  }

  if (lanes.move) {
    projects.push({
      id: 'move',
      path: 'contracts/move',
      spec: {
        projectName: 'move_treasury',
        family: 'move-contracts',
        layers: ['framework:move-package'],
        partner: null,
        slots: {},
        variables: { moduleName: 'TreasuryVault' },
      },
    })
  }

  return projects
}

function collectServiceProjects(
  lanes: LaneDetection,
  prompt: string,
  partner: string | null,
  text: string,
  registry: Registry,
): ProjectEntry[] {
  const projects: ProjectEntry[] = []

  if (lanes.mcp && !lanes.api) {
    projects.push(
      buildProtocolProject(
        'mcp',
        'apps/mcp',
        'mcp-server-ts',
        ['framework:mcp-server-ts'],
        prompt,
        null,
        {},
      ),
    )
  }
  if (lanes.dspy && !lanes.api) {
    projects.push(
      buildProtocolProject(
        'ai',
        'apps/ai',
        'dspy-pipeline-py',
        ['framework:dspy-pipeline-py'],
        prompt,
        null,
        {},
      ),
    )
  }
  if (lanes.x402 && !lanes.api) {
    projects.push({
      id: 'api',
      path: 'apps/api',
      spec: {
        projectName: `${buildSlug(prompt, 'workspace')}-api`,
        family: 'x402-service',
        layers: ['framework:x402-service'],
        partner: resolvePartnerForFamily(partner, 'x402-service'),
        slots: {},
        variables: {},
        primaryArtifactTargetMs: 2500,
      },
    })
  }
  if (lanes.zk && !lanes.api) {
    // Dispatch to the specific zkVM family when the prompt names one; fall
    // back to the generic zk-prover-service for unspecific "zk prover" /
    // "verifiable ml" / "dark pool" / "mixer" / "private voting" prompts.
    // Mirrors the single-starter routing path so workspace composition is
    // consistent with single-family selection.
    let zkFamily = 'zk-prover-service'
    let zkFramework = 'framework:zk-prover-service'
    const zkVars: Record<string, string> = {}
    if (
      text.includes('risc zero') ||
      text.includes('risc0') ||
      text.includes('risczero') ||
      text.includes('bonsai')
    ) {
      zkFamily = 'risczero-zkvm'
      zkFramework = 'framework:risczero-zkvm'
    } else if (text.includes('sp1') || text.includes('succinct')) {
      zkFamily = 'sp1-zkvm'
      zkFramework = 'framework:sp1-zkvm'
    } else if (
      text.includes('arkworks') ||
      text.includes('hand-rolled r1cs') ||
      text.includes('custom snark circuit')
    ) {
      zkFamily = 'arkworks-prover'
      zkFramework = 'framework:arkworks-prover'
    } else {
      // Generic fallback — keep the pre-existing proof-system slot logic so
      // the generic scaffold composes with a proofSystem hint.
      zkVars.proofSystem = text.includes('circom') ? 'circom' : 'sp1'
    }
    projects.push(
      buildProtocolProject('zk', 'apps/prover', zkFamily, [zkFramework], prompt, null, zkVars),
    )
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
  const lanes = detectLanes(prompt, text, partner, registry)
  if (!shouldBeWorkspace(lanes, text, partner)) return null

  const projects: ProjectEntry[] = []
  if (lanes.frontend) projects.push(buildWebProject(prompt, partner, text, registry))
  if (lanes.api || lanes.implicitApi)
    projects.push(buildApiProject(prompt, partner, text, registry))
  if (lanes.worker || lanes.implicitWorker) projects.push(buildWorkerProject(prompt, partner, text))

  projects.push(...collectServiceProjects(lanes, prompt, partner, text, registry))
  projects.push(...collectProtocolProjects(lanes, prompt, partner, text, registry))

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
      const briefResult = await rewriteViaBrief({
        prompt,
        partner,
        knownFamilies,
        knownCapabilities,
      })
      if (briefResult) {
        const plan = await planPrompt({
          prompt: briefResult.canonicalPrompt,
          partner,
          forceKind,
          familyHint,
          rewriter: false,
          brief: false,
        })
        return { ...plan, brief: briefResult.brief }
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
        return planPrompt({
          prompt: rewrite.canonicalPrompt,
          partner,
          forceKind,
          familyHint,
          rewriter: false,
        })
      }
    }
  }

  const { result: plan, durationMs } = await traced('planPrompt', async () => {
    const text = prompt.toLowerCase()
    const effectivePartner = partner ?? inferPartner(text)
    const registry = await loadRegistry()

    // Skip workspace detection when caller knows this is a single project
    if (forceKind !== 'starter') {
      const workspacePlan = buildWorkspacePromptPlan({
        prompt,
        partner: effectivePartner,
        text,
        registry,
      })
      if (workspacePlan) {
        return workspacePlan
      }
    }

    // Partner-first routing. When the workspace check did NOT fire and the
    // buildout trace carries an EXPLICIT partnerGuess (e.g. `tangle-network`,
    // `polymarket-prediction`, `coinbase-smart-wallet`, `deno`) that aligns
    // with a registry family via tags / keywords / id tokens, promote the
    // prompt to a single-project workspace wrapping the partner-aligned
    // family. This absorbs demand from newly-promoted domain-specific
    // families (polymarket-portfolio-hedging, kyc-onboarding,
    // fraud-ops-console, tangle-blueprint, deno-edge, …) that otherwise
    // disappear into generic workspace composition.
    //
    // Narrowing — MUST preserve routing_stability:
    //   (1) Only fires on an explicit caller-supplied `partner`. The soft
    //       `inferPartner(text)` heuristic is too eager — it tags `'tangle'`
    //       on any prompt containing "tangle", which breaks coverage tests
    //       that expect starter-mode routing for bare protocol prompts.
    //   (2) Only fires when the workspace planner already declined, so the
    //       28 currently-routed workspace scenarios are never touched.
    //   (3) forceKind === 'starter' callers (scaffold-builder with a
    //       curated family) bypass this branch.
    const PARTNER_FIRST_SURFACES = new Set([
      'frontend',
      'api',
      'agent-service',
      'fullstack',
      'blueprint',
    ])
    if (forceKind !== 'starter' && partner) {
      const partnerMatch = shouldPromotePartnerFirst(partner, registry)
      if (partnerMatch && PARTNER_FIRST_SURFACES.has(partnerMatch.surface)) {
        const fwLayers: string[] = []
        for (const [key, layer] of registry.layers) {
          if (layer.group === 'framework' && layer.appliesTo?.includes(partnerMatch.familyId)) {
            fwLayers.push(key)
          }
        }
        const slug = buildSlug(prompt, 'workspace')
        // Surface → project id + path. Mirrors how buildWebProject /
        // buildApiProject name their outputs so downstream artifact selectors
        // (primaryArtifact.kind, path) remain consistent.
        const surfaceConfig: Record<
          string,
          { id: string; path: string; artifactKind: string; artifactPath: string }
        > = {
          frontend: { id: 'web', path: 'apps/web', artifactKind: 'preview', artifactPath: '/' },
          fullstack: { id: 'web', path: 'apps/web', artifactKind: 'preview', artifactPath: '/' },
          api: { id: 'api', path: 'apps/api', artifactKind: 'service', artifactPath: '/health' },
          'agent-service': {
            id: 'agent',
            path: 'apps/agent',
            artifactKind: 'service',
            artifactPath: '/health',
          },
          blueprint: {
            id: 'blueprint',
            path: 'protocols/tangle',
            artifactKind: 'service',
            artifactPath: '/health',
          },
        }
        const cfg = surfaceConfig[partnerMatch.surface] ?? surfaceConfig.frontend
        const wrapped: PromptPlan = {
          kind: 'workspace',
          confidence: 'medium',
          reasons: [`partner-first → ${partnerMatch.familyId} (aligned to ${partner})`],
          spec: {
            workspaceName: `${slug}-workspace`,
            userPrompt: prompt,
            launchPlan: {
              primaryProjectId: cfg.id,
              primaryArtifact: { kind: cfg.artifactKind, path: cfg.artifactPath, targetMs: 2500 },
              initialAgentMission:
                "Build the user's prompt on top of this partner-aligned scaffold. The starter was chosen because the partner has a dedicated family in the registry — lead with the domain-specific surfaces.",
            },
            projects: [
              {
                id: cfg.id,
                path: cfg.path,
                spec: {
                  projectName: `${slug}-${cfg.id}`,
                  family: partnerMatch.familyId,
                  layers: fwLayers,
                  partner: resolvePartnerForFamily(partner, partnerMatch.familyId),
                  slots: {},
                  variables: {},
                  primaryArtifactTargetMs: 2500,
                },
              },
            ],
          },
        }
        return wrapped
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
        routingRisk: 'safe',
      }
    } else {
      starterSelection = await selectStarter({ prompt, partner: effectivePartner })
      // Specialty-family override: selectStarter's tiered keyword score sometimes
      // lets a generic sibling (python-api, expo-react-native-ts, tauri-desktop,
      // agent-service-ts, fullstack-ts) beat a more specialized family that the
      // prompt clearly demands. When the prompt carries unambiguous phrases, we
      // pick the specialty family directly.
      const specialtyRules: { family: string; phrases: string[] }[] = [
        {
          family: 'expo-rn-rich',
          phrases: [
            'skia',
            'reanimated',
            'rich animations mobile',
            'expo skia',
            'expo reanimated',
            'react native skia',
          ],
        },
        {
          family: 'tauri-tray',
          phrases: [
            'tauri system tray',
            'system tray daemon',
            'tray icon only',
            'tray menu daemon',
          ],
        },
        {
          family: 'tauri-menubar',
          phrases: ['macos menubar', 'menu bar app', 'raycast-like', 'floating panel app'],
        },
        {
          family: 'electron-native-os',
          phrases: [
            'electron native os',
            'deep links desktop',
            'native os integration',
            'auto updater electron',
          ],
        },
        {
          family: 'voice-first-agent',
          phrases: [
            'voice-first conversational',
            'voice first agent',
            'browser mic agent',
            'push to talk agent',
          ],
        },
        {
          family: 'vision-first-agent',
          phrases: ['camera agent', 'vision-first agent', 'visual qa agent'],
        },
        {
          family: 'multimodal-agent',
          phrases: ['multimodal agent', 'text image audio agent', 'gpt-4o client app'],
        },
        {
          family: 'webgpu-inference',
          phrases: ['webgpu browser compute', 'webgpu inference', 'wgsl matmul', 'wgsl compute'],
        },
        {
          family: 'webgpu-render',
          phrases: ['raw webgpu', 'wgsl graphics', 'wgsl vertex', 'webgpu triangle'],
        },
        { family: 'bevy-web', phrases: ['bevy web game', 'bevy wasm', 'rust web game'] },
        { family: 'godot-web', phrases: ['godot 4 web', 'godot html5', 'godot web game'] },
        { family: 'unity-web-proxy', phrases: ['unity webgl export', 'unity web build'] },
        {
          family: 'livekit-sfu',
          phrases: ['livekit sfu', 'self-hosted livekit', 'selective forwarding unit'],
        },
        { family: 'hls-origin', phrases: ['hls origin', 'hls live streaming', 'rtmp ingest'] },
        {
          family: 'realtime-audio-ts',
          phrases: ['realtime audio visualiz', 'webaudio analyser', 'peer audio'],
        },
        {
          family: 'hipaa-compliance-pack',
          phrases: [
            'hipaa compliance pack',
            'hipaa-compliant compliance pack',
            'phi audit trail and baa',
            'baa template',
          ],
        },
        {
          family: 'soc2-compliance-pack',
          phrases: [
            'soc 2 type ii compliance pack',
            'soc 2 compliance pack',
            'soc2 compliance pack',
            'change management and incident response',
          ],
        },
        {
          family: 'pci-dss-compliance-pack',
          phrases: [
            'pci-dss 4.0 compliance pack',
            'pci dss compliance pack',
            'pan redaction and stripe tokenization',
            'pci compliance pack',
          ],
        },
        {
          family: 'gdpr-compliance-pack',
          phrases: [
            'gdpr compliance pack',
            'gdpr-compliant consent management',
            'data subject rights endpoint',
          ],
        },
        {
          family: 'healthcare-hipaa-backend',
          phrases: ['hipaa-compliant', 'phi audit log', 'healthcare backend'],
        },
        {
          family: 'fintech-ledger-backend',
          phrases: ['double-entry ledger', 'double entry ledger', 'debits and credits'],
        },
        {
          family: 'legal-case-mgmt',
          phrases: ['legal case management', 'matter management', 'attorney timekeeping'],
        },
        { family: 'k12-edtech', phrases: ['k-12 edtech', 'k12 edtech', 'ferpa'] },
        { family: 'crm-backend', phrases: ['sales crm', 'deals pipeline', 'sales pipeline'] },
        {
          family: 'ecommerce-headless',
          phrases: ['headless commerce', 'ecommerce backend', 'cart checkout'],
        },
        { family: 'aptos-move', phrases: ['aptos move', 'aptos_framework', 'aptos framework'] },
        { family: 'celestia-da', phrases: ['celestia', 'data availability node', 'celestia blob'] },
        { family: 'ollama-server', phrases: ['ollama local', 'ollama server', 'gguf'] },
        { family: 'sglang-server', phrases: ['sglang', 'radix attention'] },
        { family: 'tgi-server', phrases: ['text generation inference', 'huggingface tgi'] },
        { family: 'triton-server', phrases: ['nvidia triton', 'triton inference'] },
        { family: 'skypilot-serving', phrases: ['skypilot', 'sky serve'] },
        { family: 'lora-training', phrases: ['lora fine-tun', 'qlora', 'lora training'] },
        {
          family: 'streamlit-advanced',
          phrases: ['multipage streamlit', 'streamlit multipage', 'production streamlit'],
        },
        { family: 'jupyter-book', phrases: ['jupyter book', 'jupyterbook', 'executable book'] },
        {
          family: 'observable-notebook',
          phrases: ['observable framework', 'observablehq', 'observable notebook'],
        },
        { family: 'eleventy-static', phrases: ['eleventy', '11ty'] },
        { family: 'hugo-static', phrases: ['hugo static', 'hugo site', 'hugo blog'] },
        { family: 'zola-static', phrases: ['zola static', 'zola site', 'tera template'] },
        { family: 'astro-static', phrases: ['astro static', 'astro islands'] },
        { family: 'threejs-game', phrases: ['three.js', 'threejs', 'webgl 3d scene'] },
        { family: 'phaser-game', phrases: ['phaser 3', '2d arcade game'] },
        { family: 'pixijs-game', phrases: ['pixi.js v8', 'pixijs', '2d webgpu'] },
        {
          family: 'flutter-app',
          phrases: ['flutter app', 'flutter dart', 'material design flutter', 'cupertino flutter'],
        },
        {
          family: 'kotlin-multiplatform',
          phrases: ['kotlin multiplatform', 'compose multiplatform', 'kmp kotlin', 'expect-actual'],
        },
        {
          family: 'esp32-rust',
          phrases: ['esp32 rust', 'esp-idf-svc', 'xtensa rust', 'espressif rust'],
        },
        {
          family: 'stm32-rust',
          phrases: ['stm32 rust', 'embassy stm32', 'stm32 embassy', 'stm32 bare metal'],
        },
        {
          family: 'ros2-node-py',
          phrases: ['ros2 rclpy', 'ros2 python node', 'rclpy publisher', 'ros2 node python'],
        },
      ]
      const lower = prompt.toLowerCase()
      for (const rule of specialtyRules) {
        if (starterSelection.spec.family === rule.family) break
        if (!registry.families.has(rule.family)) continue
        if (rule.phrases.some((p) => lower.includes(p))) {
          const fwLayers: string[] = []
          for (const [key, layer] of registry.layers) {
            if (layer.group === 'framework' && layer.appliesTo?.includes(rule.family))
              fwLayers.push(key)
          }
          starterSelection = {
            confidence: 'high',
            spec: {
              ...starterSelection.spec,
              family: rule.family,
              layers: fwLayers,
            },
            fallbackUsed: false,
            reasons: [`specialty override → ${rule.family}`],
            routingRisk: 'safe',
          }
          break
        }
      }
    }
    const family = registry.families.get(starterSelection.spec.family)
    const spec: ComposeSpec = {
      ...starterSelection.spec,
      // Scrub partner if it's incompatible with the selected family — otherwise
      // composeStarter throws at compose time, after the caller has already
      // allocated a workspace and shown the user a "preparing" UI (blueprint-
      // agent bug report #3).
      partner: resolvePartnerForFamily(
        starterSelection.spec.partner ?? effectivePartner,
        starterSelection.spec.family,
      ),
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

    if (databaseSlot && family?.slots?.database) spec.slots.database = databaseSlot
    if (sdkSlot && family?.slots?.sdk) spec.slots.sdk = sdkSlot
    if (authSlot && family?.slots?.auth) spec.slots.auth = authSlot
    if (paymentsSlot && family?.slots?.payments) spec.slots.payments = paymentsSlot
    if (queueSlot && family?.slots?.queue) spec.slots.queue = queueSlot

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

  const family =
    plan.kind === 'starter' ? plan.spec.family : (plan.spec.projects?.[0]?.spec.family ?? 'unknown')
  const capabilities =
    plan.kind === 'starter'
      ? (plan.spec.layers ?? []).filter((l: string) => l.startsWith('capability:'))
      : (plan.spec.projects?.flatMap((p: { spec: { layers?: string[] } }) =>
          (p.spec.layers ?? []).filter((l: string) => l.startsWith('capability:')),
        ) ?? [])

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
