// Record of Processing Activities (RoPA) — Art. 30 requires every
// controller to maintain this. Structure: per data category, the
// legal basis, retention period, recipients, and international transfers.

export type LegalBasis =
  | 'consent'
  | 'contract'
  | 'legal-obligation'
  | 'vital-interests'
  | 'public-task'
  | 'legitimate-interests'

export interface DataCategory {
  name: string
  /** Which table / collection / system this lives in. */
  location: string
  /** Example fields — do not exhaustively enumerate PII inline. */
  fields: string[]
  legalBasis: LegalBasis
  /** If legitimate-interests, the LIA document path. */
  liaReference?: string
  retentionDays: number
  /** Third parties that receive this category. */
  recipients: string[]
  internationalTransfer?: { country: string; safeguard: string }
}

export interface RecordOfProcessing {
  controllerName: string
  controllerContact: string
  dpoContact?: string
  updatedAt: string
  categories: DataCategory[]
}

export const EXAMPLE_ROPA: RecordOfProcessing = {
  controllerName: 'Example Co.',
  controllerContact: 'privacy@example.com',
  dpoContact: 'dpo@example.com',
  updatedAt: '2026-04-21',
  categories: [
    {
      name: 'account',
      location: 'users table',
      fields: ['email', 'name', 'passwordHash'],
      legalBasis: 'contract',
      retentionDays: 2555, // 7 years for account records
      recipients: ['better-auth (auth provider)'],
    },
    {
      name: 'billing',
      location: 'stripe + billing_events table',
      fields: ['paymentMethodId', 'last4', 'amount', 'currency'],
      legalBasis: 'contract',
      retentionDays: 2555,
      recipients: ['Stripe'],
      internationalTransfer: { country: 'US', safeguard: 'EU-US Data Privacy Framework' },
    },
    {
      name: 'analytics',
      location: 'events table',
      fields: ['userId', 'eventName', 'timestamp'],
      legalBasis: 'consent',
      retentionDays: 365,
      recipients: [],
    },
    {
      name: 'support-tickets',
      location: 'tickets table',
      fields: ['userId', 'subject', 'body', 'attachments'],
      legalBasis: 'legitimate-interests',
      liaReference: 'docs/legal/LIA-support.md',
      retentionDays: 730,
      recipients: [],
    },
  ],
}

export function validateRoPA(ropa: RecordOfProcessing): string[] {
  const issues: string[] = []
  if (!ropa.controllerName) issues.push('missing controllerName')
  if (!ropa.controllerContact) issues.push('missing controllerContact')
  for (const cat of ropa.categories) {
    if (!cat.name) issues.push(`category missing name`)
    if (cat.legalBasis === 'legitimate-interests' && !cat.liaReference) {
      issues.push(`category ${cat.name}: legitimate-interests requires liaReference`)
    }
    if (cat.retentionDays <= 0) issues.push(`category ${cat.name}: invalid retentionDays`)
    if (cat.internationalTransfer && !cat.internationalTransfer.safeguard) {
      issues.push(`category ${cat.name}: international transfer needs a safeguard (SCC, DPF, etc.)`)
    }
  }
  return issues
}
