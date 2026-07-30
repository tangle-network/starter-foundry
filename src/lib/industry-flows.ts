// Per-industry first-turn flows injected into AGENTS.md when an
// industry:<id> layer is attached. These steer the agent toward the
// right starting feature for the product archetype so it doesn't ship
// a generic SaaS shell for a doctor portal or a trading app.
//
// Each entry names the 2-3 features that matter most on turn 1 of a
// buildout for products in that industry. Kept small and specific —
// the agent reads these before choosing
// what to build. See compose.ts (renderAgentsMd) for the injection site.

interface IndustryFirstTurn {
  industry: string
  shortLabel: string
  firstFeatures: string[]
  whatNotToDo?: string[]
}

const INDUSTRY_FIRST_TURNS: Record<string, IndustryFirstTurn> = {
  health: {
    industry: 'health',
    shortLabel: 'Healthcare / wellness / mental health',
    firstFeatures: [
      'Patient intake / triage queue — a list of pending patients with name, reason-for-visit, and a "start consultation" CTA',
      'Appointment scheduler — date picker + provider select + slot grid',
      'Secure-messaging thread between provider and patient (privacy-first; no PHI in URL/query params)',
    ],
    whatNotToDo: [
      'Do not build a generic dashboard with KPIs — health products start with the patient workflow',
      'Do not put patient identifiers in URL paths or search params (HIPAA concern)',
    ],
  },
  finance: {
    industry: 'finance',
    shortLabel: 'Trading / investing / banking / DeFi',
    firstFeatures: [
      'Positions / portfolio view — holdings table with asset, quantity, cost basis, current value, unrealized P/L',
      'Trade or deposit form — amount + asset + confirm CTA with live price preview',
      'Price/performance chart (use capability:chart-widget — already attached if this industry is active)',
    ],
    whatNotToDo: [
      'Do not start with a marketing landing page — financial products land users into their account view',
      "Do not hard-code fiat symbols; read the user's region from personalize.json",
    ],
  },
  gaming: {
    industry: 'gaming',
    shortLabel: 'Games, game-adjacent tools, leaderboards',
    firstFeatures: [
      'Game view / canvas — the primary gameplay surface rendered first-pixel',
      'Session menu — start/continue/new-game + settings',
      'Leaderboard (cross-session if game supports multi-player) — top-N with your current rank highlighted',
    ],
    whatNotToDo: [
      'Do not add auth flow before the game is playable — authless "guest play" is a stronger first-turn',
      'Do not use a dashboard layout — the game canvas is the product',
    ],
  },
  ecommerce: {
    industry: 'ecommerce',
    shortLabel: 'Online stores, marketplaces, product catalogs',
    firstFeatures: [
      'Product grid — tile layout with image + name + price + quick-add',
      'Product detail page — photo gallery, description, variant select, add-to-cart',
      'Cart drawer or page with line items + quantity + subtotal + checkout CTA',
    ],
    whatNotToDo: [
      'Do not start with admin/back-office — shoppers are the primary user, always',
      'Do not skip variant selection — single-SKU products are the minority',
    ],
  },
  education: {
    industry: 'education',
    shortLabel: 'Schools, LMS, tutoring, study tools',
    firstFeatures: [
      'Course / assignment list — cards with title, due date, completion pill',
      'Assignment detail view — prompt text + submission input + submit CTA',
      'Grade / progress indicator — simple bar or ring showing completion',
    ],
    whatNotToDo: [
      'Do not start with teacher admin — student view is the primary flow for most LMS traffic',
    ],
  },
  fitness: {
    industry: 'fitness',
    shortLabel: 'Workout tracking, training plans, gyms',
    firstFeatures: [
      "Today's workout — list of exercises with reps/sets and check-off",
      'Progress chart — reps-over-time or PR trend (chart-widget)',
      'Plan selector — browse or pick a training program',
    ],
    whatNotToDo: [
      'Do not start with onboarding quiz before showing a workout — the product is the workout',
    ],
  },
  creative: {
    industry: 'creative',
    shortLabel: 'Design tools, writing tools, content studios',
    firstFeatures: [
      'Canvas / editor surface — primary creation tool rendered first',
      'Document/project list — recent files with "new" CTA prominent',
      'Export / share flow — one-click produce output in the relevant format',
    ],
    whatNotToDo: [
      'Do not start with sign-up — creative tools are used by guests first, saved later',
    ],
  },
  restaurant: {
    industry: 'restaurant',
    shortLabel: 'Restaurants, food ordering, reservations',
    firstFeatures: [
      'Menu view — categorized items with photo + price + add-to-order',
      'Order or reservation form — items/table + time + party size + confirm',
      'Order status / receipt — post-submission summary with estimated time',
    ],
    whatNotToDo: ['Do not default to a marketing landing — hungry users want the menu immediately'],
  },
  crypto: {
    industry: 'crypto',
    shortLabel: 'Web3, DeFi, NFTs, wallets',
    firstFeatures: [
      'Wallet connect button — prominent CTA at top-right, triggers wagmi/web3modal flow',
      'Primary product surface (swap/stake/mint) — the main action rendered after connect',
      'Tx history list — recent activity for the connected address',
    ],
    whatNotToDo: [
      'Do not gate the whole app behind connect — show the product surface first, prompt connect on action',
      'Do not invent token addresses — use capability:evm-wallet or equivalent for canonical refs',
    ],
  },
  saas: {
    industry: 'saas',
    shortLabel: 'B2B SaaS, internal tools, team products',
    firstFeatures: [
      'Dashboard — KPIs + recent activity + primary CTA',
      'Team / workspace selector — prominent if multi-tenancy is attached',
      'Settings / billing stub — linked from user menu even if just a placeholder',
    ],
    whatNotToDo: [
      'Do not omit tenant context — every query must scope by the active workspace',
      'Do not skip the workspace selector when capability:multi-tenancy is attached',
    ],
  },
}

/**
 * Render the industry first-turn block for AGENTS.md. Returns empty
 * string when the attached layers contain no known industry:* entry
 * — callers can unconditionally concatenate.
 */
export function renderIndustryFirstTurn(layers: string[]): string {
  const industryLayer = layers.find((l) => l.startsWith('industry:'))
  if (!industryLayer) return ''
  const id = industryLayer.split(':')[1]
  const entry = INDUSTRY_FIRST_TURNS[id]
  if (!entry) return ''

  const lines = [
    `## Industry first-turn flow — ${entry.shortLabel}`,
    '',
    `This scaffold is tagged with \`${industryLayer}\`. Products in this industry converge on a specific first-turn shape; **start there** rather than building a generic dashboard.`,
    '',
    '### Ship these first',
    ...entry.firstFeatures.map((f) => `- ${f}`),
    '',
  ]
  if (entry.whatNotToDo?.length) {
    lines.push('### Avoid', ...entry.whatNotToDo.map((d) => `- ${d}`), '')
  }
  return lines.join('\n')
}
