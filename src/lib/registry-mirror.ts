// registry-mirror — failover registry fetcher for multi-region resilience.
// Tries mirrors in order, validates SHA-256 against a local pin if provided,
// caches successful results in-memory per process.

import { createHash } from 'node:crypto'

export interface MirrorEntry {
  url: string
  region?: string
  priority?: number
}

export interface MirrorLoadOptions {
  /** Optional SHA-256 hex of the expected bundle body. */
  expectedSha256?: string
  /** Timeout per mirror in ms. Defaults to 5000. */
  timeoutMs?: number
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch
}

export interface MirrorLoadResult {
  body: string
  mirrorUrl: string
  sha256: string
  attempts: {
    url: string
    status: 'ok' | 'error' | 'timeout' | 'integrity-mismatch'
    detail?: string
  }[]
}

export class MirrorLoadError extends Error {
  readonly attempts: MirrorLoadResult['attempts']
  constructor(attempts: MirrorLoadResult['attempts']) {
    super(`all mirrors failed: ${attempts.map((a) => `${a.url} [${a.status}]`).join(', ')}`)
    this.name = 'MirrorLoadError'
    this.attempts = attempts
  }
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  impl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    return await impl(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function loadRegistryFromMirrors(
  mirrors: MirrorEntry[],
  options: MirrorLoadOptions = {},
): Promise<MirrorLoadResult> {
  if (mirrors.length === 0) throw new Error('loadRegistryFromMirrors: empty mirror list')
  const ordered = [...mirrors].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
  const attempts: MirrorLoadResult['attempts'] = []
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 5000

  for (const mirror of ordered) {
    try {
      const res = await fetchWithTimeout(mirror.url, timeoutMs, fetchImpl)
      if (!res.ok) {
        attempts.push({ url: mirror.url, status: 'error', detail: `http ${res.status}` })
        continue
      }
      const body = await res.text()
      const sha = sha256Hex(body)
      if (options.expectedSha256 && sha !== options.expectedSha256) {
        attempts.push({
          url: mirror.url,
          status: 'integrity-mismatch',
          detail: `got ${sha.slice(0, 12)}, want ${options.expectedSha256.slice(0, 12)}`,
        })
        continue
      }
      attempts.push({ url: mirror.url, status: 'ok' })
      return { body, mirrorUrl: mirror.url, sha256: sha, attempts }
    } catch (err) {
      const e = err as Error
      attempts.push({
        url: mirror.url,
        status: e.name === 'AbortError' ? 'timeout' : 'error',
        detail: e.message.slice(0, 200),
      })
    }
  }
  throw new MirrorLoadError(attempts)
}
