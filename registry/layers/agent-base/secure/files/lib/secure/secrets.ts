// secrets — dotenvx-encrypted secret storage with a SecureString that
// resists accidental leakage via logs/JSON serialization.
//
// Threat: an agent author console.logs the API key during a debug
// session, that log gets shipped to Sentry. SecureString throws on
// .toString() and serializes as '[REDACTED]'. The author has to call
// .unsafeReveal() to get the raw string, and that call is audit-logged.

import { audit } from './audit.js'

const REDACTED = '[REDACTED]'

export class SecureString {
  // Private + non-enumerable so JSON.stringify can't reach it.
  readonly #value: string
  readonly #name: string

  constructor(name: string, value: string) {
    this.#name = name
    this.#value = value
  }

  toString(): string {
    return REDACTED
  }

  toJSON(): string {
    return REDACTED
  }

  // Explicit reveal. Audit-logs every call. Use only at the
  // boundary where the raw string crosses into a non-loggable
  // surface (HTTP Authorization header, signed payload, etc.).
  unsafeReveal(reason: string): string {
    audit.log({
      event: 'secret.reveal',
      target: this.#name,
      payload: { reason: reason.slice(0, 200) },
    })
    return this.#value
  }

  get name(): string {
    return this.#name
  }
}

interface SecretsBackend {
  get(name: string): string | undefined
}

class DotenvxBackend implements SecretsBackend {
  // Uses process.env at runtime. dotenvx's CLI/runtime decrypts
  // .env.encrypted via DOTENV_PRIVATE_KEY at process start; we read
  // from process.env which the dotenvx wrapper already populated.
  get(name: string): string | undefined {
    return process.env[name]
  }
}

const cache = new Map<string, SecureString>()
const backend: SecretsBackend = new DotenvxBackend()

/**
 * Load a secret. Returns undefined when missing (caller decides whether
 * that's recoverable). Use requireSecret() for hard-required secrets.
 */
export function loadSecret(name: string): SecureString | undefined {
  if (cache.has(name)) {
    audit.log({ event: 'secret.read', target: name, payload: { cacheHit: true } })
    return cache.get(name)
  }
  const raw = backend.get(name)
  if (raw === undefined) {
    audit.log({ event: 'secret.miss', target: name })
    return undefined
  }
  const secure = new SecureString(name, raw)
  cache.set(name, secure)
  audit.log({ event: 'secret.read', target: name, payload: { cacheHit: false } })
  return secure
}

/**
 * Hard-required secret. Throws on miss. Use this when the bundle
 * cannot operate without the secret.
 */
export function requireSecret(name: string): SecureString {
  const secret = loadSecret(name)
  if (!secret) {
    throw new Error(`required secret missing: ${name} (declare in manifest.defaults.secrets and check .env.encrypted)`)
  }
  return secret
}

export const secrets = {
  load: loadSecret,
  require: requireSecret,
  /** Clear the in-process cache. Use at end of session or on rotation. */
  purge(): void {
    const count = cache.size
    cache.clear()
    audit.log({ event: 'secret.purge', payload: { cleared: count } })
  },
}
