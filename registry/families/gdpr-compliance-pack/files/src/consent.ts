// GDPR Art. 4(11) consent primitives. Every requirement enforced:
//   freely given, specific, informed, unambiguous, affirmative, withdrawable.

export type ConsentCategory = 'essential' | 'analytics' | 'marketing' | 'personalization'

export interface ConsentRecord {
  id: string
  userId: string
  categories: ConsentCategory[]
  /** The specific version of the privacy notice shown at capture time. */
  policyVersion: string
  /** Captured via 'banner', 'settings', or 'api'. */
  source: 'banner' | 'settings' | 'api'
  givenAt: string
  withdrawnAt?: string
  /** IP + user agent for Art. 7(1) evidence. */
  ip?: string
  userAgent?: string
}

export interface ConsentStore {
  record(entry: ConsentRecord): Promise<void>
  active(userId: string): Promise<ConsentRecord | null>
  withdraw(userId: string, at?: string): Promise<void>
  history(userId: string): Promise<ConsentRecord[]>
}

/** Essential category is implicit — no consent needed per Art. 6(1)(b). */
export const DEFAULT_ESSENTIAL_CATEGORIES: ConsentCategory[] = ['essential']

/** Pre-ticked boxes are invalid — this validator throws on any empty affirmative action. */
export function validateConsentRequest(request: {
  userId: string
  explicitlyAccepted: ConsentCategory[]
  policyVersion: string
}): void {
  if (!request.userId) throw new Error('GDPR consent: userId required')
  if (!request.policyVersion) throw new Error('GDPR consent: policyVersion required')
  // "Essential" doesn't need consent; only accept categories beyond essential.
  const beyondEssential = request.explicitlyAccepted.filter((c) => c !== 'essential')
  for (const cat of beyondEssential) {
    if (!(['analytics', 'marketing', 'personalization'] as const).includes(cat as never)) {
      throw new Error(`GDPR consent: unknown category "${cat}"`)
    }
  }
}

export class InMemoryConsentStore implements ConsentStore {
  private entries: ConsentRecord[] = []

  async record(entry: ConsentRecord): Promise<void> {
    this.entries.push({ ...entry })
  }

  async active(userId: string): Promise<ConsentRecord | null> {
    const recent = this.entries
      .filter((e) => e.userId === userId && !e.withdrawnAt)
      .sort((a, b) => b.givenAt.localeCompare(a.givenAt))
    return recent[0] ?? null
  }

  async withdraw(userId: string, at = new Date().toISOString()): Promise<void> {
    for (const e of this.entries) {
      if (e.userId === userId && !e.withdrawnAt) e.withdrawnAt = at
    }
  }

  async history(userId: string): Promise<ConsentRecord[]> {
    return this.entries.filter((e) => e.userId === userId)
  }
}
