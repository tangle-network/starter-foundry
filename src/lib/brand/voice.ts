// voice — rewrite BrandKit copy in a target voice register.
// LLM path uses AxLLM when a router key is present. Deterministic fallback
// applies a word-substitution table so the output is stable in tests + offline.

import { ax } from '@ax-llm/ax'

import { createLLM, isLLMAvailable } from '../llm.js'

import type { BrandKit } from './index.js'

export type VoiceRegister = 'formal' | 'casual' | 'technical' | 'playful' | 'neutral'

export const INDUSTRY_VOICE: Record<string, VoiceRegister> = {
  fitness: 'casual',
  fintech: 'formal',
  healthcare: 'technical',
  legal: 'formal',
  crypto: 'technical',
  ecommerce: 'casual',
  edtech: 'casual',
  realestate: 'formal',
  travel: 'casual',
  saas: 'neutral',
}

export function defaultVoiceForIndustry(industry: string | undefined): VoiceRegister {
  if (!industry) return 'neutral'
  return INDUSTRY_VOICE[industry.toLowerCase()] ?? 'neutral'
}

const voiceRewriter = ax(
  'originalCopy:string, targetVoice:string, brandName:string -> rewrittenCopy:string',
)

// Deterministic substitution table — same input always produces the same
// output. Not great prose, but stable for tests + offline operation.
const SUBSTITUTIONS: Record<VoiceRegister, [RegExp, string][]> = {
  formal: [
    [/\bget\b/gi, 'obtain'],
    [/\bhelp\b/gi, 'assist'],
    [/\bbuild\b/gi, 'construct'],
    [/\bawesome\b/gi, 'exceptional'],
    [/!+/g, '.'],
  ],
  casual: [
    [/\butilize\b/gi, 'use'],
    [/\bobtain\b/gi, 'get'],
    [/\btherefore\b/gi, 'so'],
    [/\bassist\b/gi, 'help'],
  ],
  technical: [
    [/\bset up\b/gi, 'configure'],
    [/\bfix\b/gi, 'remediate'],
    [/\buse\b/gi, 'leverage'],
    [/\bfast\b/gi, 'low-latency'],
  ],
  playful: [
    [/\bbuild\b/gi, 'craft'],
    [/\.+$/, '!'],
  ],
  neutral: [],
}

function rewriteDeterministic(text: string, voice: VoiceRegister): string {
  let out = text
  for (const [pattern, replacement] of SUBSTITUTIONS[voice]) {
    out = out.replace(pattern, replacement)
  }
  return out
}

async function rewriteLLM(
  text: string,
  voice: VoiceRegister,
  brandName: string,
): Promise<string | null> {
  if (!isLLMAvailable()) return null
  try {
    const llm = createLLM()
    const out = (await voiceRewriter.forward(llm, {
      originalCopy: text,
      targetVoice: voice,
      brandName,
    })) as { rewrittenCopy?: string }
    return out.rewrittenCopy ?? null
  } catch {
    return null
  }
}

export interface VoiceApplyResult {
  kit: BrandKit
  voice: VoiceRegister
  source: 'llm' | 'deterministic'
}

export async function applyVoice(kit: BrandKit, voice: VoiceRegister): Promise<VoiceApplyResult> {
  if (voice === 'neutral' || voice === kit.voice) {
    return { kit, voice, source: 'deterministic' }
  }

  const llmTagline = await rewriteLLM(kit.tagline, voice, kit.brandName)
  const llmHeadline = await rewriteLLM(kit.heroHeadline, voice, kit.brandName)
  const llmSubheadline = await rewriteLLM(kit.heroSubheadline, voice, kit.brandName)

  const source: 'llm' | 'deterministic' =
    llmTagline && llmHeadline && llmSubheadline ? 'llm' : 'deterministic'

  const nextKit: BrandKit = {
    ...kit,
    voice,
    tagline: llmTagline ?? rewriteDeterministic(kit.tagline, voice),
    heroHeadline: llmHeadline ?? rewriteDeterministic(kit.heroHeadline, voice),
    heroSubheadline: llmSubheadline ?? rewriteDeterministic(kit.heroSubheadline, voice),
  }
  return { kit: nextKit, voice, source }
}
