import { createHmac, timingSafeEqual } from 'node:crypto'

type Provider = 'stripe' | 'github' | 'generic'

function computeHmac(algorithm: string, key: string, data: string): Buffer {
  return createHmac(algorithm, key).update(data, 'utf8').digest()
}

function safeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function verifyStripe(payload: string, signature: string, secret: string): boolean {
  const parts = signature.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3)
  if (!timestamp || !v1) {
    throw new Error('Stripe: malformed signature header — expected t= and v1= fields')
  }
  const signedPayload = `${timestamp}.${payload}`
  const expected = computeHmac('sha256', secret, signedPayload)
  const received = Buffer.from(v1, 'hex')
  return safeCompare(expected, received)
}

function verifyGitHub(payload: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) {
    throw new Error('GitHub: signature must start with sha256= prefix')
  }
  const expected = computeHmac('sha256', secret, payload)
  const received = Buffer.from(signature.slice(7), 'hex')
  return safeCompare(expected, received)
}

function verifyGeneric(payload: string, signature: string, secret: string): boolean {
  const expected = computeHmac('sha256', secret, payload)
  const received = Buffer.from(signature, 'hex')
  return safeCompare(expected, received)
}

const verifiers: Record<Provider, (payload: string, signature: string, secret: string) => boolean> = {
  stripe: verifyStripe,
  github: verifyGitHub,
  generic: verifyGeneric,
}

export function verifySignature(
  provider: string,
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const verify = verifiers[provider as Provider]
  if (!verify) {
    throw new Error(`Unsupported webhook provider: ${provider}`)
  }
  return verify(payload, signature, secret)
}

export type { Provider }
