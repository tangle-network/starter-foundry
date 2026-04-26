// Brand generation library. Given a user prompt + industry, produce a
// concrete brand kit: name, tagline, color palette (HSL), typography stack,
// voice/tone guidance. Consumers splice this into personalize.json +
// personalize.css at compose time.
//
// LLM path (when router key present) → full generative brand kit.
// Deterministic fallback → industry-preset palette from registry/layers/
// industry/*/files/personalize.css, voice = "neutral", typography = Inter.

import { ax } from '@ax-llm/ax'

import { createLLM, isLLMAvailable } from '../llm.js'

export interface BrandKit {
  brandName: string
  tagline: string
  heroHeadline: string
  heroSubheadline: string
  voice: 'formal' | 'casual' | 'technical' | 'playful' | 'neutral'
  palette: {
    primary: string
    secondary: string
    accent: string
    background: string
    foreground: string
  }
  typography: { sans: string; mono: string }
  source: 'llm' | 'deterministic'
}

const brandAgent = ax(
  'prompt:string, industry:string -> brandName:string, tagline:string, heroHeadline:string, heroSubheadline:string, voice:string, paletteHslTriplets:string[], typographyStack:string',
)

function deterministicBrand(prompt: string, industry?: string): BrandKit {
  // Extract a noun-phrase-ish name from the prompt. Cheap, defensible, and
  // overridable by the agent in the first turn.
  const words = prompt
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length >= 4 && w.length <= 16 && !/^(build|create|scaffold|make)$/i.test(w))
    .slice(0, 2)
  const brandName =
    words.length > 0
      ? words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Starter'
      : 'Starter'

  // Industry-driven palette presets.
  const palettes: Record<string, BrandKit['palette']> = {
    fitness: {
      primary: '142 71% 45%',
      secondary: '142 40% 94%',
      accent: '30 90% 55%',
      background: '0 0% 100%',
      foreground: '142 80% 10%',
    },
    fintech: {
      primary: '220 90% 56%',
      secondary: '220 14% 96%',
      accent: '160 60% 45%',
      background: '0 0% 100%',
      foreground: '224 71% 4%',
    },
    healthcare: {
      primary: '196 80% 45%',
      secondary: '196 30% 96%',
      accent: '340 75% 55%',
      background: '0 0% 100%',
      foreground: '196 60% 10%',
    },
    crypto: {
      primary: '263 70% 50%',
      secondary: '263 30% 96%',
      accent: '30 90% 55%',
      background: '263 15% 8%',
      foreground: '263 20% 94%',
    },
    default: {
      primary: '220 90% 56%',
      secondary: '220 14% 96%',
      accent: '160 60% 45%',
      background: '0 0% 100%',
      foreground: '224 71% 4%',
    },
  }
  const palette = palettes[industry ?? 'default'] ?? palettes.default

  return {
    brandName,
    tagline: 'Ship the thing. Iterate in public.',
    heroHeadline: brandName,
    heroSubheadline: `A ${industry ?? 'production-ready'} starter the agent will make yours on turn 1.`,
    voice: 'neutral',
    palette,
    typography: {
      sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
      mono: 'JetBrains Mono, ui-monospace, monospace',
    },
    source: 'deterministic',
  }
}

export async function generateBrand(args: {
  prompt: string
  industry?: string
}): Promise<BrandKit> {
  if (!isLLMAvailable()) return deterministicBrand(args.prompt, args.industry)
  try {
    const llm = createLLM()
    const raw = (await brandAgent.forward(llm, {
      prompt: args.prompt,
      industry: args.industry ?? 'general',
    })) as {
      brandName?: string
      tagline?: string
      heroHeadline?: string
      heroSubheadline?: string
      voice?: string
      paletteHslTriplets?: string[]
      typographyStack?: string
    }
    const triplets = Array.isArray(raw.paletteHslTriplets) ? raw.paletteHslTriplets : []
    const fallback = deterministicBrand(args.prompt, args.industry)
    return {
      brandName: raw.brandName || fallback.brandName,
      tagline: raw.tagline || fallback.tagline,
      heroHeadline: raw.heroHeadline || fallback.heroHeadline,
      heroSubheadline: raw.heroSubheadline || fallback.heroSubheadline,
      voice: (['formal', 'casual', 'technical', 'playful', 'neutral'].includes(raw.voice ?? '')
        ? raw.voice
        : 'neutral') as BrandKit['voice'],
      palette: {
        primary: triplets[0] ?? fallback.palette.primary,
        secondary: triplets[1] ?? fallback.palette.secondary,
        accent: triplets[2] ?? fallback.palette.accent,
        background: triplets[3] ?? fallback.palette.background,
        foreground: triplets[4] ?? fallback.palette.foreground,
      },
      typography: raw.typographyStack
        ? { sans: raw.typographyStack, mono: fallback.typography.mono }
        : fallback.typography,
      source: 'llm',
    }
  } catch {
    return deterministicBrand(args.prompt, args.industry)
  }
}

/** Merge a BrandKit into the personalize.json that composes into the scaffold. */
export function brandToPersonalizeJson(kit: BrandKit): Record<string, unknown> {
  return {
    brand: { name: kit.brandName, tagline: kit.tagline },
    hero: { headline: kit.heroHeadline, subheadline: kit.heroSubheadline },
    voice: kit.voice,
    _source: kit.source,
  }
}

/** Render a BrandKit's palette into the HSL-custom-property block used by personalize.css. */
export function brandToPersonalizeCss(kit: BrandKit): string {
  return [
    ':root {',
    `  --color-primary: hsl(${kit.palette.primary});`,
    `  --color-secondary: hsl(${kit.palette.secondary});`,
    `  --color-accent: hsl(${kit.palette.accent});`,
    `  --color-background: hsl(${kit.palette.background});`,
    `  --color-foreground: hsl(${kit.palette.foreground});`,
    `  --font-sans: ${kit.typography.sans};`,
    `  --font-mono: ${kit.typography.mono};`,
    '}',
    '',
  ].join('\n')
}
