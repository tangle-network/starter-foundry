import { ax } from '@ax-llm/ax'
import { createLLM, isLLMAvailable } from './llm.js'
import type { BuildPlan, ComposeSpec, ResolvedComponents } from '../types.js'

const FAMILY_ARCHITECTURE: Record<string, string[]> = {
  'nextjs-ts': ['Next.js App Router', 'Server Components', 'Server Actions for mutations', 'Middleware for auth'],
  'react-vite-ts': ['React SPA', 'Vite build', 'Client-side routing', 'REST or tRPC for backend'],
  'fullstack-ts': ['Node.js HTTP server', 'TypeScript with experimental strip-types', 'Server-rendered HTML', 'JSON API endpoints'],
  'sveltekit-ts': ['SvelteKit with SSR', 'File-based routing', 'Form actions', 'Load functions'],
  'remix-ts': ['Remix with nested routing', 'Loaders for data fetching', 'Actions for mutations', 'Progressive enhancement'],
  'vue-ts': ['Vue 3 Composition API', 'Vite build', 'Client-side routing with vue-router'],
  'angular-ts': ['Angular standalone components', 'Signals for reactivity', 'Dependency injection'],
  'api-service': ['Node.js HTTP server', 'JSON API', 'Health endpoint pattern'],
  'python-api': ['Python HTTP server', 'JSON API', 'Async handlers if using FastAPI'],
  'go-api': ['Go net/http', 'JSON API', 'Middleware chain'],
  'rust-service': ['Rust HTTP server', 'Typed routes', 'Error handling with Result'],
  'agent-service-ts': ['Agent control loop: plan → act → reflect', 'Tool registration', 'Memory/state management', 'HTTP health endpoint'],
  'agent-service-py': ['Agent control loop: plan → act → reflect', 'Tool registration', 'Memory/state management', 'HTTP health endpoint'],
  'agent-service-rust': ['Agent control loop: plan → act → reflect', 'Tool registration', 'Typed state management'],
  'forge-contracts': ['Foundry project', 'Solidity contracts in src/', 'Tests in test/', 'Deploy scripts in script/'],
  'hardhat-contracts': ['Hardhat TypeScript', 'Contracts in contracts/', 'Deploy tasks', 'Hardhat config with network settings'],
  'worker-job': ['Background worker loop', 'RUN_ONCE mode for validation', 'Signal handling for graceful shutdown'],
  'cloudflare-worker-ts': ['Cloudflare Worker', 'Edge runtime', 'Durable Objects if stateful'],
}

function gatherBuildHints(components: ResolvedComponents): {
  pages: string[]
  apiRoutes: string[]
  componentNames: string[]
  dataModels: string[]
  integrations: string[]
  architectureNotes: string[]
} {
  const pages: string[] = []
  const apiRoutes: string[] = []
  const componentNames: string[] = []
  const dataModels: string[] = []
  const integrations: string[] = []
  const architectureNotes: string[] = []

  for (const layer of components.layers) {
    const hints = layer.buildHints
    if (!hints) continue
    if (hints.pages) pages.push(...hints.pages)
    if (hints.apiRoutes) apiRoutes.push(...hints.apiRoutes)
    if (hints.components) componentNames.push(...hints.components)
    if (hints.dataModels) dataModels.push(...hints.dataModels)
    if (hints.integrations) integrations.push(...hints.integrations)
    if (hints.architectureNotes) architectureNotes.push(...hints.architectureNotes)
  }

  return {
    pages: [...new Set(pages)],
    apiRoutes: [...new Set(apiRoutes)],
    componentNames: [...new Set(componentNames)],
    dataModels: [...new Set(dataModels)],
    integrations: [...new Set(integrations)],
    architectureNotes: [...new Set(architectureNotes)],
  }
}

export function generateBuildPlan(
  spec: ComposeSpec,
  components: ResolvedComponents,
): BuildPlan {
  const prompt = spec.userPrompt ?? ''
  const familyArch = FAMILY_ARCHITECTURE[spec.family] ?? []
  const hints = gatherBuildHints(components)

  const architecture = [...familyArch, ...hints.architectureNotes]
  const pages = hints.pages
  const apiRoutes = hints.apiRoutes
  const componentNames = hints.componentNames
  const dataModels = hints.dataModels
  const integrations = hints.integrations

  // Generate first moves based on what's in the scaffold
  const firstMoves: string[] = []
  if (prompt) {
    firstMoves.push(`User goal: "${prompt}"`)
  }
  if (pages.length > 0) {
    firstMoves.push(`Create pages: ${pages.join(', ')}`)
  }
  if (apiRoutes.length > 0) {
    firstMoves.push(`Wire API routes: ${apiRoutes.join(', ')}`)
  }
  if (componentNames.length > 0) {
    firstMoves.push(`Build components: ${componentNames.join(', ')}`)
  }
  if (integrations.length > 0) {
    firstMoves.push(`Integrate: ${integrations.join(', ')}`)
  }
  if (firstMoves.length === 0) {
    firstMoves.push('Extend the entry points listed in the compose report.')
    firstMoves.push('Run the validated commands to verify the scaffold works before editing.')
  }

  // Generate design directive for frontend families
  const designDirective = generateDesignDirective(spec, components)

  // Extract shadcn preset code from layer defaults
  const shadcnLayer = components.layers.find(
    (l) => l.group === 'capability' && l.id === 'shadcn',
  )
  const presetCode = shadcnLayer?.defaults?.presetCode as string | undefined ?? null

  return {
    goal: prompt || `Build a ${spec.family} project`,
    architecture,
    pages,
    apiRoutes,
    components: componentNames,
    dataModels,
    integrations,
    firstMoves,
    designDirective,
    presetCode,
  }
}

const enhancerAgent = ax(
  'userPrompt:string, family:string, layers:string[], composedFiles:string[], templateFirstMoves:string[] -> firstMoves:string[], openQuestions:string[]',
)

export interface EnhanceArgs {
  spec: ComposeSpec
  base: BuildPlan
  composedFiles: string[]
}

export type EnhancerFn = (args: EnhanceArgs) => Promise<BuildPlan>

let testEnhancerOverride: EnhancerFn | null = null
export function __setTestEnhancer(fn: EnhancerFn | null): void {
  testEnhancerOverride = fn
}

async function enhanceBuildPlanWithLLMImpl({ spec, base, composedFiles }: EnhanceArgs): Promise<BuildPlan> {
  if (!isLLMAvailable()) return base
  const prompt = spec.userPrompt ?? ''
  if (!prompt) return base

  const llm = createLLM()
  let raw: { firstMoves?: string[]; openQuestions?: string[] }
  try {
    raw = (await enhancerAgent.forward(llm, {
      userPrompt: prompt,
      family: spec.family,
      layers: spec.layers ?? [],
      composedFiles,
      templateFirstMoves: base.firstMoves,
    })) as { firstMoves?: string[]; openQuestions?: string[] }
  } catch {
    return base
  }

  const firstMoves = Array.isArray(raw.firstMoves) && raw.firstMoves.length > 0
    ? raw.firstMoves.map((m) => String(m)).filter(Boolean)
    : base.firstMoves

  const openQuestions = Array.isArray(raw.openQuestions)
    ? raw.openQuestions.map((q) => String(q)).filter(Boolean)
    : []

  const augmented: BuildPlan = {
    ...base,
    firstMoves,
  }
  if (openQuestions.length > 0) {
    augmented.firstMoves = [...firstMoves, ...openQuestions.map((q) => `OPEN: ${q}`)]
  }
  return augmented
}

export function enhanceBuildPlanWithLLM(args: EnhanceArgs): Promise<BuildPlan> {
  return (testEnhancerOverride ?? enhanceBuildPlanWithLLMImpl)(args)
}

const FRONTEND_FAMILIES = new Set([
  'react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'sveltekit-ts',
  'remix-ts', 'vue-ts', 'angular-ts', 'frontend-static',
  'electron-desktop-ts', 'tauri-desktop', 'expo-react-native-ts',
  'browser-extension-ts',
])

/**
 * Generate prompt-based design directives for the AI agent.
 * These are English rules about aesthetics, not CSS — the LLM follows them
 * when generating Tailwind classes and component markup.
 */
function generateDesignDirective(
  spec: ComposeSpec,
  components: ResolvedComponents,
): string | null {
  if (!FRONTEND_FAMILIES.has(spec.family)) return null

  const layerIds = new Set(components.layers.map((l) => `${l.group}:${l.id}`))
  const hasShadcn = layerIds.has('capability:shadcn')
  const hasTailwind = layerIds.has('capability:tailwind')
  const hasDashboard = layerIds.has('capability:dashboard-layout')

  const rules: string[] = [
    'DESIGN RULES (follow these when generating UI code):',
    '',
    'General:',
    '- Build polished, production-quality interfaces — not prototypes.',
    '- Use consistent spacing (p-4, p-6, gap-4, gap-6). Avoid arbitrary values.',
    '- Every interactive element needs hover and focus states.',
    '- Support dark mode via the .dark class and CSS custom properties.',
    '- Use subtle transitions (transition-colors, duration-150) on interactive elements.',
    '- Prefer rounded-lg for cards and rounded-md for buttons and inputs.',
  ]

  if (hasShadcn) {
    rules.push(
      '',
      'shadcn/ui:',
      '- 27 components pre-installed in src/components/ui/: Alert, Avatar, Badge, Breadcrumb, Button, Card, Checkbox, Command, Dialog, DropdownMenu, Form, Input, Label, Progress, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Switch, Table, Tabs, Textarea, Toast, Toggle, Tooltip.',
      '- Import directly: import { Button } from "@/components/ui/button"',
      '- Use the cn() utility from @/lib/utils for merging Tailwind classes.',
      '- Never ship unstyled native HTML when a shadcn component exists.',
      '- For Radix-powered versions, install @radix-ui/* and update the component.',
      '- Follow the new-york style: tighter spacing, smaller radius, more refined.',
    )
  }

  if (hasTailwind) {
    rules.push(
      '',
      'Tailwind:',
      '- Use the design token colors (bg-background, text-foreground, bg-card, etc.) — never hardcode hex values.',
      '- Use the color scale for emphasis: text-muted-foreground for secondary text, bg-muted for subtle backgrounds.',
      '- Responsive: mobile-first. Use sm:, md:, lg: breakpoints.',
    )
  }

  if (hasDashboard) {
    rules.push(
      '',
      'Layout:',
      '- Sidebar: 16rem default, collapsible to 4rem with icon-only mode.',
      '- Header: sticky, contains breadcrumb trail, search/command palette trigger, theme toggle, user menu.',
      '- Content: max-w-7xl mx-auto, p-6 padding.',
      '- Mobile: sidebar collapses to a Sheet/Drawer triggered by hamburger.',
    )
  }

  rules.push(
    '',
    'Quality bar:',
    '- Every page should look intentionally designed, not like a code demo.',
    '- Use proper empty states with illustrations or icons.',
    '- Loading states: use Skeleton components, not spinners.',
    '- Error states: use destructive variant Badge or Alert, not raw text.',
  )

  return rules.join('\n')
}
