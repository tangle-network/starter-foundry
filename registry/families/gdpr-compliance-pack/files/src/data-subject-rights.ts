// Data Subject Rights — Art. 15 (access/export) + Art. 17 (erasure) + Art. 20 (portability).
// The 30-day SLA applies to each. This module ships the framework-agnostic
// contract; HTTP/router bindings live in the consuming service.

export interface DataExport {
  userId: string
  exportedAt: string
  /** Categories of data included in the export (data inventory). */
  categories: string[]
  /** JSON-structured data payload. */
  payload: Record<string, unknown>
  /** Machine-readable format per Art. 20 — default "application/json". */
  format: string
}

export interface ErasureRequest {
  userId: string
  requestedAt: string
  /** Tied to one of the Art. 17 grounds so we can document it. */
  basis:
    | 'no-longer-necessary'
    | 'consent-withdrawn'
    | 'objection-art-21'
    | 'unlawfully-processed'
    | 'legal-obligation'
    | 'consent-of-child'
}

export interface ErasureDecision {
  userId: string
  honoredAt?: string
  refusedAt?: string
  refusalBasis?: 'legal-obligation' | 'public-interest' | 'legal-claims' | 'freedom-of-expression'
  refusalExplanation?: string
}

export interface DataSubjectRightsHandler {
  export(userId: string): Promise<DataExport>
  erase(request: ErasureRequest): Promise<ErasureDecision>
}

/**
 * Compose a data export by fanning out to per-category collectors. Each
 * collector knows its own table/columns. Returns a single JSON payload
 * suitable for right-to-portability (Art. 20).
 */
export type CategoryCollector = (userId: string) => Promise<Record<string, unknown>>

export async function collectExport(
  userId: string,
  collectors: Record<string, CategoryCollector>,
): Promise<DataExport> {
  const payload: Record<string, unknown> = {}
  for (const [category, collect] of Object.entries(collectors)) {
    try {
      payload[category] = await collect(userId)
    } catch (err) {
      payload[category] = { __error: (err as Error).message }
    }
  }
  return {
    userId,
    exportedAt: new Date().toISOString(),
    categories: Object.keys(collectors),
    payload,
    format: 'application/json',
  }
}

/**
 * Honor an erasure request, calling each per-category eraser. Art. 17(3)
 * exceptions are checked via `shouldRetain` — if any returns a basis, the
 * request is REFUSED with a documented reason (per Art. 12(4)).
 */
export type CategoryEraser = (userId: string) => Promise<void>
export type RetentionChecker = (userId: string) => Promise<ErasureDecision['refusalBasis'] | null>

export async function honorErasure(
  request: ErasureRequest,
  erasers: Record<string, CategoryEraser>,
  retentionChecks: RetentionChecker[] = [],
): Promise<ErasureDecision> {
  for (const check of retentionChecks) {
    const basis = await check(request.userId)
    if (basis) {
      return {
        userId: request.userId,
        refusedAt: new Date().toISOString(),
        refusalBasis: basis,
        refusalExplanation: `Art. 17(3) exception applies: ${basis}`,
      }
    }
  }
  for (const erase of Object.values(erasers)) {
    await erase(request.userId)
  }
  return { userId: request.userId, honoredAt: new Date().toISOString() }
}
