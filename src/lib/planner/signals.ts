// Signal constants used across the planner. Pure data — no behavior.
// Every list is a hasAny-style substring match; case handled by the caller.
//
// Grouped by where the signal fires in the pipeline:
//   - Lane detection:      FRONTEND_SIGNALS, API_SIGNALS, WORKER_SIGNALS,
//                          FULLSTACK_SIGNALS, WORKSPACE_SIGNALS, SINGLE_LANE_SIGNALS,
//                          FRAMEWORK_API_TERMS, STRONG_API_TERMS,
//                          EXPLICIT_WORKER_SIGNALS
//   - Archetype inference: IMPLICIT_UI_FAMILIES, REACT_FAMILIES,
//                          CHAT_ARCHETYPE_SIGNALS, CHART_STRONG_SIGNALS,
//                          AI_PRODUCT_PHRASES, VIDEO_ARCHETYPE_SIGNALS,
//                          ADMIN_ARCHETYPE_SIGNALS, AUTH_ARCHETYPE_SIGNALS

// Families where implicit UI capability inference fires (archetype-based
// dashboard/chat/chart attachment). Moving it out of this set means losing
// the auto-attached React UI layers.
export const IMPLICIT_UI_FAMILIES = new Set([
  'react-vite-ts',
  'nextjs-ts',
  'fullstack-ts',
  'remix-ts',
])

// React families that get unconditional tailwind + shadcn attachment.
// Keep in sync with IMPLICIT_UI_FAMILIES — any addition here should also
// go there.
export const REACT_FAMILIES = new Set([
  'react-vite-ts',
  'nextjs-ts',
  'fullstack-ts',
  'remix-ts',
  // S+ tier new React+Vite families — auto-attach tailwind + shadcn so
  // agents don't have to `pnpm add` them every time. Signal from
  // .evolve/buildout-analysis.json topAddedPackages (17× lucide-react,
  // 14× tailwindcss, 9× clsx) showed these utilities are near-universal
  // across real agent work.
  'electron-native-os',
  'multimodal-agent',
])

// Chat-first archetype: product's primary surface is a conversational thread,
// not a data-heavy dashboard. Matches phrases where the user interacts by
// talking to the AI (assistant / tutor / companion) or the product IS a chatbot.
export const CHAT_ARCHETYPE_SIGNALS = [
  'chatbot',
  'chat bot',
  'support bot',
  'ai assistant',
  'cooking assistant',
  'shopping assistant',
  'writing assistant',
  'personal assistant',
  'ai tutor',
  'language tutor',
  'homework help',
  'homework helper',
  'bedtime stor',
  'voice companion',
  'ai companion',
  'symptom checker',
  'describe what',
  'i describe',
  'conversations with',
  'conversation with me',
  'has conversations',
  'chat with me',
  'chats with me',
  'texts me',
  'explains concepts',
  // dialogue-shape prompts: "I tell it...", "I ask it..."
  'tell it ',
  'ask it ',
  'tells me',
  'tells you',
]

// STRONG chart signals — single match triggers chart-widget. Each is a
// near-certain indicator of a data-viz surface. Intentionally avoids single
// words like "track" / "patterns" / "trends" / "charts" which carry too many
// unrelated senses (seating charts, music tracks, movement patterns).
export const CHART_STRONG_SIGNALS = [
  'gantt',
  'burndown',
  'kpi',
  'analytics',
  'metrics',
  'churn',
  'sentiment analysis',
  'sentiment patterns',
  'sentiment over time',
  'see trends',
  'shows sentiment',
  'price changes',
  'price tracking',
  'tracks price',
  'tracks floor',
  'tracks mentions',
  'tracks what performs',
  'compensation trends',
  'salary ranges',
  'portfolio tracker',
  'portfolio value',
  'floor prices',
  'valuation',
  'sales reporting',
  'auto-generates esg',
  'sustainability reports',
  'status reports',
  'yield farming',
  'apys across',
  'competitive pricing',
  'competitor websites',
  'listing aggregator',
  'auto-compound',
  'neighborhood trends',
  'comparable sales',
  'deals below market',
  'churn metrics',
  'nps tracking',
  'low-stock alerts',
  'categorizes spending',
  'savings tips',
  'payment tracking',
  "track what's paid",
  'coaching opportunities',
  'see stats',
  'see metrics',
  'dashboard to see',
  'performance tracking',
  'p&l',
  'revenue metrics',
]

// AI product signals — literal phrases that indicate "the product is AI-powered"
// and likely ships a chat surface. Kept as a hasAny list (case-insensitive
// word-boundary match via matchesKeyword) rather than a wide regex.
export const AI_PRODUCT_PHRASES = [
  'ai app',
  'ai tool',
  'ai platform',
  'ai assistant',
  'ai agent',
  'ai bot',
  'ai advisor',
  'ai tutor',
  'ai companion',
  'ai writer',
  'ai scheduler',
  'ai analyzer',
  'ai optimizer',
  'ai planner',
  'ai generator',
  'ai helper',
  'ai reviewer',
  'ai builder',
  'ai engine',
  'ai system',
  'ai pipeline',
  'ai workflow',
  'ai manager',
  'ai screener',
  'ai screening',
  'ai coach',
  'ai copilot',
  'ai feature',
  'ai cooking',
  'ai personal',
  'ai language',
  'ai voice',
  'ai travel',
  'ai meal',
  'ai interior',
  'ai code',
  'ai recipe',
  'ai resume',
  'ai social',
  'ai customer',
  'ai legal',
  'ai medical',
  'ai homework',
  'ai newsletter',
  'ai podcast',
  'ai video',
  'ai property',
  'ai content',
  'ai data',
  'ai recruit',
  'ai symptom',
  'ai image',
  'ai photo',
  'ai audio',
  'ai chat',
  'ai email',
  'ai search',
  'ai-powered',
  'ai-driven',
  'generative ai',
  'artificial intelligence',
  // "AI <verb>s ..." — "AI does X" in plain language
  'ai suggests',
  'ai turns',
  'ai generates',
  'ai highlights',
  'ai writes',
  'ai answers',
  'ai analyzes',
  'ai estimates',
  'ai categor',
  'ai identif',
  'ai creat',
  'ai cuts',
  'ai tailors',
  'ai adapts',
  'ai screens',
  'ai extracts',
  'ai explains',
  'ai reads',
  'ai understands',
  'ai processes',
  'ai translates',
  'ai summar',
  'ai detects',
  'ai recommends',
  'ai scores',
  // "AI that/to/for ..." shapes
  'ai that',
  'ai to ',
  'ai which',
  'ai for',
  // "build/make/create me an ai ..."
  'an ai ',
  'a ai ',
  // Implicit-AI products (no literal "AI" but the capability is AI-dependent)
  'transcribes',
  'transcription',
  'gives me a summary',
  'summarizes',
  'auto-summar',
  'automatically generates',
  'automatically cuts',
]

// Implicit video/call surface — natural prompts that describe video rooms,
// consultations, low-latency audio, or streaming without saying "webrtc".
export const VIDEO_ARCHETYPE_SIGNALS = [
  'video consultation',
  'video consultations',
  'video rooms',
  'video room',
  'video call',
  'video calls',
  'video updates',
  'video conferencing',
  'video conference',
  'virtual co-working',
  'virtual coworking',
  'low-latency audio',
  'persistent video',
  'video tutoring',
  'async video',
  'screen sharing',
  'shared whiteboard',
  'telehealth',
  'livekit',
  'peer-to-peer',
  'jam session',
]

// SaaS archetypes — multi-customer products where tenant isolation is
// non-negotiable. When the prompt describes a SaaS shape (teams, orgs,
// workspaces, subscription tiers, customer accounts), the scaffold must
// ship capability:multi-tenancy by default so agents don't bolt it on
// after deploy (tenant leakage is a P0 bug, not a nice-to-have).
export const SAAS_ARCHETYPE_SIGNALS = [
  'saas',
  'saas app',
  'saas product',
  'saas platform',
  'saas tool',
  'team management',
  'teams and members',
  'organization',
  'organizations',
  'workspace',
  'workspaces',
  'customer accounts',
  'customer portal',
  'subscription tiers',
  'subscription plans',
  'billing plans',
  'usage-based billing',
  'per-seat billing',
  'tenant',
  'tenants',
  'multi-tenant',
  'multi tenancy',
  'per-tenant',
  'tenant isolation',
  'workspace-level',
  'org-level',
  'account-scoped',
]

// Admin/operations archetypes — internal SaaS tools with bulk management,
// document workflows, role-based access, approval flows. These want layout-admin
// alongside layout-dashboard.
export const ADMIN_ARCHETYPE_SIGNALS = [
  'onboarding tool',
  'onboarding app',
  'employee onboarding',
  'vendor onboarding',
  'approval workflow',
  'approval flow',
  'back office',
  'content management',
  'data table',
  'crud operations',
  'role-based',
  'multi-step sign-off',
  'dues collection',
  'maintenance requests',
  'document storage',
  'collects documents',
  'auto-assign',
  'assigns tasks',
  'hr tool',
  'admin panel',
]

// Code-editor surface: AI code assistants, prompt playgrounds, markdown
// editors with code blocks, SQL query builders, config UIs. Triggers
// capability:code-editor attachment on web-producing families.
export const CODE_EDITOR_ARCHETYPE_SIGNALS = [
  'code editor',
  'query editor',
  'sql editor',
  'prompt playground',
  'code playground',
  'syntax highlight',
  'syntax highlighting',
  'markdown editor',
  'config editor',
  'schema editor',
  'json editor',
  'javascript editor',
  'typescript editor',
  'codemirror',
  'code dashboard',
  'strategy editor',
  '"strategy" editor',
  'strategy builder',
  'script editor',
  'rules editor',
  'dsl editor',
  'embedded editor',
  'policy editor',
  'workflow editor',
  'expression editor',
  // Trading-bot / quant phrasings — agent-trading scenario shipped
  // codemirror 5x because the "TypeScript snippet" editor surface wasn't
  // recognized as needing capability:code-editor. Add the realistic
  // domain language so future trading/algorithm/strategy prompts attach.
  'typescript snippet',
  'typescript snippet editor',
  'algorithm editor',
  'algo editor',
  'algorithm playground',
  'trading strategy',
  'on-chain strategy',
  'inline editor',
  'code snippet editor',
  'live editor',
]

// Date-heavy products — scheduling, calendar, timeline, booking, deadline
// tracking. Triggers capability:date-utils attachment on web-producing
// families. Kept narrow: "dashboard" isn't date-heavy, but "scheduling
// dashboard" is.
//
// Governance/DAO phrasings surface here because every proposal UI shows
// "ends at", "voting period", "pending → active → executed" — all
// time-relative renders that need date-fns. Observed in dao-proposals
// scenarios (3× date-fns install cluster, 2026-04-22 trace corpus).
export const DATE_HEAVY_ARCHETYPE_SIGNALS = [
  'calendar',
  'scheduling',
  'booking',
  'appointment',
  'timeline',
  'deadline',
  'date range',
  'date picker',
  'recurring event',
  'relative time',
  'event scheduler',
  'reminders',
  'due date',
  'time tracking',
  // Governance archetypes — proposals have state transitions on timelines,
  // voting periods with "ends at" relative rendering, execution queues.
  'dao',
  'governance',
  'proposal',
  'voting period',
  'quorum',
  'governor bravo',
  'on-chain governance',
  'snapshot vote',
]

// Browser-native ZK: products where proofs are generated client-side
// (snarkjs + circom) rather than on a Rust prover service. Mixers, private
// voting, anonymous credentials, commitment-nullifier flows. Triggers
// capability:zk-browser attachment on web-producing families.
export const ZK_BROWSER_ARCHETYPE_SIGNALS = [
  'mixer',
  'privacy-preserving mixer',
  'private voting',
  'anonymous voting',
  'anonymous credential',
  'nullifier',
  'commitment preimage',
  'merkle root display',
  'zk proof',
  'zk-snark',
  'zero-knowledge proof',
  'circom',
  'zk mixer',
  'verify your note',
  'downloadable note',
  'stealth address',
  'private deposit',
  'private withdraw',
]

// Auth/portal archetypes — client portals, tenant portals, customer-specific
// views with login flows.
export const AUTH_ARCHETYPE_SIGNALS = [
  'client portal',
  'customer portal',
  'tenant portal',
  'accounting firm',
  'document portal',
  'share tax returns',
  'patient portal',
  'secure login',
]

// Multi-page archetypes — products that have more than one view, needing a
// client-side router on Vite/Electron/Tauri hosts (Next.js / Remix /
// SvelteKit have file-based routers and don't get this capability).
// Observed in dao-proposals (3× react-router-dom install cluster) +
// expected in any list-detail pattern.
export const ROUTING_ARCHETYPE_SIGNALS = [
  'proposal list',
  'proposal detail',
  'list and detail',
  'multi-page',
  'nested routes',
  'nested layouts',
  'dashboard with pages',
  'admin panel with pages',
  'portal with multiple views',
  'navigation menu',
  'deep linking',
  'route params',
  'url params',
  'tabs with pages',
]

// ZK circuit DSLs / frameworks that LAYER onto existing families. zkVMs
// themselves (RISC Zero, SP1, Arkworks) are separate families — they
// route through planPrompt's family selection, not via capability signals.
//
// Naming: all end in _ARCHETYPE_SIGNALS so signal-manifest parity test
// catches any drift between these arrays and the capability manifests'
// tieredKeywords.archetypes lists.
export const ZK_NOIR_ARCHETYPE_SIGNALS = [
  'noir',
  'aztec noir',
  'barretenberg',
  'nargo',
  'ultrahonk',
  'honk prover',
  'aztec noir circuit',
  'build a noir program',
  'noir zk app',
  'nargo new',
  'ultrahonk verifier',
]
export const ZK_GNARK_ARCHETYPE_SIGNALS = [
  'gnark',
  'consensys gnark',
  'gnark circuit',
  'groth16 gnark',
  'plonk gnark',
  'gnark prover in go',
  'consensys gnark circuit',
  'gnark groth16 service',
  'zk rollup sequencer in go',
  'go-native zk proof',
]

// Single-surface families that never become workspaces.
export const SINGLE_LANE_SIGNALS = [
  'expo',
  'react native',
  'mobile app',
  'ios app',
  'android app',
  'browser extension',
  'chrome extension',
  'manifest v3',
  'electron',
  'desktop app',
  'desktop assistant',
  'command line',
  'terminal tool',
  'streamlit',
  'gradio',
  'data app',
  'tauri',
]

export const FRONTEND_SIGNALS = [
  'frontend',
  'ui',
  'website',
  'landing',
  'dashboard',
  'web app',
  'app',
  'preview',
  'next',
  'react',
  'platform',
  'dapp',
  'interface',
  'portal',
  // "X page" / "Y screen" — UI nouns. Buildout corpus showed prompts like
  // "DEX swap page" / "NFT mint page" routing to forge-contracts only
  // because no frontend signal matched.
  'page',
  'screen',
  'mint page',
  'swap page',
  'bridge page',
  'staking page',
  'claim page',
]

export const API_SIGNALS = [
  'api',
  'backend',
  'server',
  'endpoint',
  'service',
  'webhook',
  'health check',
  'cloudflare',
  'durable object',
  'edge api',
  'edge function',
  'payment webhook',
  'server wallet',
  'rest api',
  'graphql api',
]

// Framework namespace "api" mentions that aren't REST APIs — disambiguate.
export const FRAMEWORK_API_TERMS = [
  'composition api',
  'options api',
  'signals api',
  'context api',
  'hooks api',
]
export const STRONG_API_TERMS = [
  'backend',
  'server',
  'endpoint',
  'webhook',
  'rest api',
  'graphql api',
  'api service',
  'api endpoint',
  'health check',
]

export const WORKER_SIGNALS = [
  'trading bot',
  'background job',
  'background worker',
  'worker for',
  'playwright worker',
  'automation worker',
  'go worker',
  'golang worker',
  'queue',
  'cron',
  'market stream',
  'bot',
]

export const EXPLICIT_WORKER_SIGNALS = [
  'trading bot',
  'background job',
  'background worker',
  'worker for',
  'playwright worker',
  'automation worker',
  'go worker',
  'golang worker',
  'queue',
  'cron',
  'market stream',
]

export const FULLSTACK_SIGNALS = [
  'fullstack',
  'full stack',
  'dashboard with api',
  'app with api',
  'admin app',
  'admin panel',
  'database-backed',
  'dashboard and api',
  'admin flows',
  'saas',
  'saas app',
  'saas platform',
  'internal tool',
  'back office',
  'crud app',
]

export const WORKSPACE_SIGNALS = [
  'workspace',
  'monorepo',
  'separate backend',
  'separate api',
  'background worker',
  'contract lane',
  'contract lanes',
]
