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

  return {
    goal: prompt || `Build a ${spec.family} project`,
    architecture,
    pages,
    apiRoutes,
    components: componentNames,
    dataModels,
    integrations,
    firstMoves,
  }
}
