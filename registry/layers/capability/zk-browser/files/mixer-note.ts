// Mixer note helpers — serialize a (commitment, nullifier, secret) tuple
// into a downloadable JSON blob the user saves after deposit and re-uploads
// at withdraw. Commitment + nullifier hash go on-chain; the nullifier
// preimage + secret stay in the user's possession as the "note".

import { poseidonHash } from './zkproof'

export interface MixerNote {
  version: 1
  nullifier: string
  secret: string
  commitment: string
  nullifierHash: string
  createdAt: number
}

/**
 * Generate a fresh note. The caller deposits `commitment` on-chain and keeps
 * `nullifier + secret` private. At withdraw time, the user supplies the
 * note back to the circuit which proves knowledge of (nullifier, secret)
 * such that Poseidon(nullifier, secret) === commitment.
 */
export async function generateNote(): Promise<MixerNote> {
  const nullifier = randomFieldElement()
  const secret = randomFieldElement()
  const commitment = (await poseidonHash([BigInt(nullifier), BigInt(secret)])).toString()
  const nullifierHash = (await poseidonHash([BigInt(nullifier)])).toString()
  return {
    version: 1,
    nullifier,
    secret,
    commitment,
    nullifierHash,
    createdAt: Date.now(),
  }
}

/** Recompute commitment from a note and verify it matches. */
export async function verifyNote(note: MixerNote): Promise<boolean> {
  if (note.version !== 1) return false
  try {
    const commitment = (await poseidonHash([BigInt(note.nullifier), BigInt(note.secret)])).toString()
    const nullifierHash = (await poseidonHash([BigInt(note.nullifier)])).toString()
    return commitment === note.commitment && nullifierHash === note.nullifierHash
  } catch {
    return false
  }
}

export function serializeNote(note: MixerNote): string {
  return JSON.stringify(note, null, 2)
}

export function parseNote(raw: string): MixerNote | null {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.nullifier !== 'string' || typeof parsed?.secret !== 'string') return null
    if (typeof parsed?.commitment !== 'string') return null
    return parsed as MixerNote
  } catch {
    return null
  }
}

export function downloadNote(note: MixerNote, filename = `mixer-note-${note.createdAt}.json`): void {
  const blob = new Blob([serializeNote(note)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Cryptographically random 254-bit field element (< BN254 prime). Values
// above the prime are rejected and retried — a rare branch (<6% probability).
const BN254_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')

function randomFieldElement(): string {
  const bytes = new Uint8Array(32)
  for (;;) {
    crypto.getRandomValues(bytes)
    bytes[0] &= 0x3f
    let value = 0n
    for (const byte of bytes) value = (value << 8n) | BigInt(byte)
    if (value < BN254_PRIME) return value.toString()
  }
}
