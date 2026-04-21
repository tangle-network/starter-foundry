// Industry-specific first-turn flows. When a composed scaffold targets an
// industry vertical, the agent's first turn should hit domain-specific steps
// — not "install deps and poke around." Emit as an "# First Turn Flow"
// section in AGENTS.md.

export interface FirstTurnFlow {
  industry: string
  steps: string[]
  /** Families the flow applies to. */
  appliesTo: string[]
}

const FLOWS: FirstTurnFlow[] = [
  {
    industry: 'healthcare',
    appliesTo: ['healthcare-hipaa-backend', 'fullstack-ts', 'api-service', 'python-api'],
    steps: [
      'Define patients, encounters, providers schema (Drizzle or SQLAlchemy) — include audit_logs as an append-only table.',
      'Wire PHI-access middleware: every read/write of a PHI-bearing column MUST emit an audit row before returning.',
      'Configure field-level AES-256-GCM encryption for SSN, DOB, medical record numbers.',
      'Add a BAA acknowledgment page + gate API keys behind signed BAA upload.',
      'Set retention policy for audit_logs (≥6 years per HIPAA §164.316(b)(2)(i)).',
      'Never log PHI to stdout, structured logs, or error traces — add a sanitizer to the logger layer.',
    ],
  },
  {
    industry: 'fintech',
    appliesTo: ['fintech-ledger-backend', 'api-service', 'python-api', 'fullstack-ts'],
    steps: [
      'Define accounts, transactions, entries schema — NUMERIC(20,4) for amounts, NEVER float.',
      'Enforce double-entry invariant in DB: CHECK(SUM(debit) = SUM(credit) per transaction_id).',
      'Wire idempotency on every write endpoint — unique (source, client_reference).',
      'Point-in-time balance query: SELECT SUM(debit - credit) WHERE account_id = ? AND posted_at <= ?.',
      'Add reconciliation job that flags orphaned entries (no matching counterparty).',
      'Use decimal.js (JS) or decimal.Decimal (Python) for all arithmetic; ban direct * / operators on monetary values.',
    ],
  },
  {
    industry: 'legal',
    appliesTo: ['legal-case-mgmt', 'fullstack-ts', 'api-service'],
    steps: [
      'Define matters, parties, documents, time_entries, invoices, billing_rates schema.',
      'Make documents content-addressed (sha256 over blob) + immutable — no UPDATE on documents table.',
      'Time entries: integer minutes + ISO-8601 workedAt timestamp; ban float hours.',
      'Billing-rate resolver: time-bounded rate_history lookup at each entry\'s workedAt.',
      'Invoice draft generator: aggregates unbilled time_entries, resolves rate, emits per-matter PDF.',
      'Attorney-client privilege: gate document access by matter_id ∈ user.accessible_matters.',
    ],
  },
  {
    industry: 'k12',
    appliesTo: ['k12-edtech', 'fullstack-ts', 'api-service'],
    steps: [
      'Define students, teachers, classes, enrollments, assignments, submissions, grades, parents, parent_students schema.',
      'FERPA: every grade READ (not just write) emits a row to grade_access_logs BEFORE returning.',
      'Parent access gate: parent → student via parent_students.custodial_rights = true (not just same email).',
      'Grade amendments are NEW rows with amends_grade_id FK — never UPDATE an existing grade.',
      'Export endpoint: one-click PDF per student per term (transcript) — required by 34 CFR §99.31.',
      'Minimum-necessary filter: teachers see only students in their classes; parents see only their children.',
    ],
  },
  {
    industry: 'ecommerce',
    appliesTo: ['ecommerce-headless', 'fullstack-ts', 'nextjs-ts', 'api-service'],
    steps: [
      'Define products, variants, carts, line_items, orders, payments, webhook_events schema.',
      'Snapshot unit_price + sku at add-to-cart time — line items MUST NOT read from current product price.',
      'Inventory decrement in SAME transaction as order placement; ban the two-step "order then decrement" pattern.',
      'Stripe PaymentIntent: client_reference_id = cart_id, idempotency_key = cart_id + attempt.',
      'Webhook handler: verify signature on raw body BEFORE JSON.parse; dedupe by webhook_events.event_id UNIQUE.',
      'Refund flow: creates a new credit line; ban UPDATE on completed orders.',
    ],
  },
  {
    industry: 'crm',
    appliesTo: ['crm-backend', 'fullstack-ts', 'api-service'],
    steps: [
      'Define contacts, companies, deals, activities, stages, pipelines, deal_stage_history schema.',
      'Deal amounts in integer cents + per-row currency code (no locale ambiguity).',
      'Stage transitions log to deal_stage_history — never mutate deal.stage without the audit row.',
      'Activity-timestamp is source of truth for lastTouched; don\'t denormalize onto the contact.',
      'Pipeline-value report: SUM(amount * stage.probability) GROUP BY stage.',
      'Deduplication: contact email + company domain as natural keys; offer a merge UI instead of blocking.',
    ],
  },
  {
    industry: 'trading',
    appliesTo: ['evm-infra-ts', 'agent-service-ts', 'worker-job', 'fullstack-ts'],
    steps: [
      'Wire market-data WebSocket (not REST polling) for live book.',
      'Define PnL computation: realized (closed positions) + unrealized (mark-to-market on open).',
      'Risk limits middleware: check position size + margin BEFORE order submission, not after.',
      'Stream order-book viz — subscribe at the component level, unsubscribe on unmount.',
      'Never store private keys in the frontend — sign in a worker or via a wallet adapter.',
    ],
  },
]

export function firstTurnFlowForIndustry(industry: string | undefined): string[] {
  if (!industry) return []
  const match = FLOWS.find((f) => f.industry === industry.toLowerCase())
  return match?.steps ?? []
}

export function firstTurnFlowForFamily(family: string, industry?: string): string[] {
  // Prefer industry-specific when the family matches; otherwise fall back.
  const byIndustry = industry ? FLOWS.find((f) => f.industry === industry.toLowerCase() && f.appliesTo.includes(family)) : null
  if (byIndustry) return byIndustry.steps
  const byFamily = FLOWS.find((f) => f.appliesTo.includes(family))
  return byFamily?.steps ?? []
}

export function listKnownIndustries(): string[] {
  return FLOWS.map((f) => f.industry)
}

export function firstTurnFlowAsMarkdown(family: string, industry?: string): string {
  const steps = firstTurnFlowForFamily(family, industry)
  if (steps.length === 0) return ''
  const heading = industry ? `## First turn flow — ${industry}` : '## First turn flow'
  return [heading, '', ...steps.map((s, i) => `${i + 1}. ${s}`), ''].join('\n')
}
