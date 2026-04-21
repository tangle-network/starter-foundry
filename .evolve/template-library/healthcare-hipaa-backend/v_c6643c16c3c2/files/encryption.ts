// Field-level PHI encryption using AES-256-GCM.
//
// Wire format (bytea stored in Postgres):
//   [12-byte IV][16-byte GCM tag][N-byte ciphertext]
//
// Key sourcing:
//   Dev: PHI_ENCRYPTION_KEY env — 64-char hex (32 bytes) OR 44-char base64.
//   Prod: rotate via envelope encryption with a KMS (AWS KMS, GCP KMS,
//         HashiCorp Vault). This module accepts a raw 32-byte key; the
//         KMS wrapping belongs in src/kms.ts (add when you wire prod).
//
// The random IV per encryption is REQUIRED for AES-GCM security. Reusing
// IV + key on different plaintexts breaks confidentiality and lets an
// attacker recover both plaintexts from the keystream XOR.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function loadKey(): Buffer {
  const raw = process.env['PHI_ENCRYPTION_KEY']
  if (!raw) {
    throw new Error(
      'PHI_ENCRYPTION_KEY is not set — refusing to start. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }
  if (key.length !== 32) {
    throw new Error(`PHI_ENCRYPTION_KEY must be 32 bytes (got ${key.length}). Use hex or base64.`)
  }
  return key
}

let cachedKey: Buffer | null = null
function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey()
  return cachedKey
}

/** Encrypt a string as a bytea payload. Returns null for null/undefined input so optional columns stay null. */
export function encryptPhi(plaintext: string | null | undefined): Buffer | null {
  if (plaintext == null) return null
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct])
}

/** Decrypt a bytea payload back to plaintext. Throws on auth-tag mismatch (tampering / wrong key). */
export function decryptPhi(payload: Buffer | null | undefined): string | null {
  if (payload == null) return null
  if (payload.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('encrypted payload too short — is this an AES-GCM blob?')
  }
  const iv = payload.subarray(0, IV_LEN)
  const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = payload.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
