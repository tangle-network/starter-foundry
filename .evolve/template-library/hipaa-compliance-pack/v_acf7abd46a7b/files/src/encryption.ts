// AES-256-GCM field-level encryption helpers — for PHI at rest in columns
// like SSN, DOB, MRN, free-text clinical notes. Per-field IV (96-bit)
// concatenated with the ciphertext so one encrypted value is self-contained.
// Key management: the application supplies a 256-bit key via KMS / Vault —
// NEVER from env vars on the filesystem for production workloads.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV is the AES-GCM standard.
const TAG_LENGTH = 16 // 128-bit auth tag.
const KEY_LENGTH = 32 // 256-bit key.

export class PhiEncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhiEncryptionError'
  }
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH) {
    throw new PhiEncryptionError(`PHI encryption key must be ${KEY_LENGTH} bytes; got ${key.length}`)
  }
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns base64url( iv || ciphertext || tag ) — self-contained, safe to
 * store in a single column.
 */
export function encryptPhi(plaintext: string, key: Buffer): string {
  assertKey(key)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, ciphertext, tag]).toString('base64url')
}

/**
 * Decrypt a ciphertext produced by `encryptPhi`. Throws PhiEncryptionError
 * on tag mismatch (tampering) or malformed input.
 */
export function decryptPhi(encoded: string, key: Buffer): string {
  assertKey(key)
  const buf = Buffer.from(encoded, 'base64url')
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new PhiEncryptionError('ciphertext shorter than IV + tag; corrupt or wrong encoding')
  }
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(buf.length - TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch (err) {
    // GCM auth-tag verify fails → throw a class-level PhiEncryptionError so
    // callers can distinguish from plaintext-level errors.
    throw new PhiEncryptionError(
      `PHI decryption failed (auth-tag mismatch — likely tampered or wrong key): ${(err as Error).message}`,
    )
  }
}

/**
 * Generate a fresh 256-bit key (for key-generation tooling, NOT for per-request use).
 * Production code must source the key from KMS / Vault and cache it in-memory.
 */
export function generatePhiKey(): Buffer {
  return randomBytes(KEY_LENGTH)
}
