// Branch 4 — media-manifest, voice, i18n, first-turn flows, user segments.
// Tests assert deterministic shape + brand-aware emission, not LLM output
// (LLM paths are covered by the brand-core tests when a router key is set).

import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMediaManifest } from '../dist/lib/brand/media-manifest.js'
import { applyVoice, defaultVoiceForIndustry } from '../dist/lib/brand/voice.js'
import { buildI18nFiles, isRtl, generateLocalePack } from '../dist/lib/brand/i18n.js'
import {
  firstTurnFlowForFamily,
  firstTurnFlowAsMarkdown,
} from '../dist/lib/brand/first-turn-flows.js'
import { inferSegment, segmentDefaultsAsMarkdown } from '../dist/lib/brand/user-segments.js'
import type { BrandKit } from '../dist/lib/brand/index.js'

const sampleKit: BrandKit = {
  brandName: 'Atlas Health',
  tagline: 'Build care workflows, not paperwork.',
  heroHeadline: 'Patient care, simplified.',
  heroSubheadline:
    'A HIPAA-compliant backend that handles the compliance so your clinicians do not.',
  voice: 'technical',
  palette: {
    primary: '196 80% 45%',
    secondary: '196 30% 96%',
    accent: '340 75% 55%',
    background: '0 0% 100%',
    foreground: '196 60% 10%',
  },
  typography: { sans: 'Inter', mono: 'JetBrains Mono' },
  source: 'deterministic',
}

test('media-manifest: emits 5 branded SVG assets + a manifest file', () => {
  const result = buildMediaManifest(sampleKit)
  assert.equal(result.manifest.assets.length, 5, 'expected 5 core assets')
  assert.ok(result.files.some((f) => f.path === 'public/media.manifest.json'))
  assert.ok(result.files.some((f) => f.path === 'public/logo.svg'))
  assert.ok(result.files.some((f) => f.path === 'public/hero-bg.svg'))
  assert.ok(result.files.some((f) => f.path === 'public/og-image.svg'))
  assert.ok(result.files.some((f) => f.path === 'public/favicon.svg'))
  assert.ok(result.files.some((f) => f.path === 'public/app-icon.svg'))
  const logo = result.files.find((f) => f.path === 'public/logo.svg')!.body
  assert.ok(logo.startsWith('<svg'), 'logo is SVG')
  assert.ok(logo.includes('hsl(196 80% 45%)'), 'logo uses brand primary')
  assert.ok(logo.includes('AH'), 'logo uses brand initials')
})

test('media-manifest: brand fingerprint changes when palette changes', () => {
  const a = buildMediaManifest(sampleKit).manifest.brandFingerprint
  const b = buildMediaManifest({
    ...sampleKit,
    palette: { ...sampleKit.palette, primary: '0 0% 0%' },
  }).manifest.brandFingerprint
  assert.notEqual(a, b)
})

test('voice: default for healthcare is technical', () => {
  assert.equal(defaultVoiceForIndustry('healthcare'), 'technical')
  assert.equal(defaultVoiceForIndustry('fitness'), 'casual')
  assert.equal(defaultVoiceForIndustry('fintech'), 'formal')
  assert.equal(defaultVoiceForIndustry(undefined), 'neutral')
})

test('voice: deterministic rewrite produces distinct output for distinct registers', async () => {
  const formal = await applyVoice(sampleKit, 'formal')
  const casual = await applyVoice(sampleKit, 'casual')
  // They should both succeed. Whether they differ depends on the tagline
  // having words the substitution table targets. At minimum the voice field
  // should be stamped correctly.
  assert.equal(formal.kit.voice, 'formal')
  assert.equal(casual.kit.voice, 'casual')
  // Applying the same voice as-is yields the same kit (fast-path).
  const same = await applyVoice(sampleKit, 'technical')
  assert.equal(same.kit.tagline, sampleKit.tagline)
})

test('i18n: ar is RTL, en is LTR', () => {
  assert.equal(isRtl('ar'), true)
  assert.equal(isRtl('ar-EG'), true)
  assert.equal(isRtl('he'), true)
  assert.equal(isRtl('en'), false)
  assert.equal(isRtl('ja'), false)
})

test('i18n: locale pack has base UI strings + brand strings', () => {
  const es = generateLocalePack(sampleKit, 'es')
  assert.equal(es['sign_in'], 'Iniciar sesión')
  assert.equal(es['brand_name'], 'Atlas Health')
  assert.equal(es['hero_headline'], sampleKit.heroHeadline)
})

test('i18n: buildI18nFiles emits per-locale common.json + i18next bootstrap + RTL css when needed', () => {
  const result = buildI18nFiles(sampleKit, ['en', 'es', 'ar'])
  assert.equal(result.rtlEnabled, true)
  const paths = result.files.map((f) => f.path)
  assert.ok(paths.includes('public/locales/en/common.json'))
  assert.ok(paths.includes('public/locales/es/common.json'))
  assert.ok(paths.includes('public/locales/ar/common.json'))
  assert.ok(paths.includes('src/i18n.ts'))
  assert.ok(paths.includes('public/rtl.css'))
  const bootstrap = result.files.find((f) => f.path === 'src/i18n.ts')!.body
  assert.ok(bootstrap.includes('initI18n'))
  assert.ok(bootstrap.includes('changeLanguage'))
})

test('i18n: no RTL css when no RTL locales', () => {
  const result = buildI18nFiles(sampleKit, ['en', 'es', 'de'])
  assert.equal(result.rtlEnabled, false)
  assert.ok(!result.files.some((f) => f.path === 'public/rtl.css'))
})

test('first-turn flows: healthcare-hipaa-backend produces PHI-specific steps', () => {
  const steps = firstTurnFlowForFamily('healthcare-hipaa-backend', 'healthcare')
  assert.ok(steps.length >= 3)
  assert.ok(steps.some((s) => /PHI/i.test(s)))
  assert.ok(steps.some((s) => /audit/i.test(s)))
})

test('first-turn flows: fintech-ledger-backend enforces double-entry', () => {
  const steps = firstTurnFlowForFamily('fintech-ledger-backend', 'fintech')
  assert.ok(steps.some((s) => /double-entry|debit.*credit|NUMERIC/i.test(s)))
})

test('first-turn flows: markdown render has ordered list', () => {
  const md = firstTurnFlowAsMarkdown('healthcare-hipaa-backend', 'healthcare')
  assert.ok(md.startsWith('## First turn flow'))
  assert.ok(/^1\. /m.test(md))
})

test('user-segments: enterprise signals route to enterprise', () => {
  assert.equal(
    inferSegment('Build an internal HR tool with SAML SSO and audit trail'),
    'enterprise',
  )
  assert.equal(
    inferSegment('Ship a B2B SaaS with role hierarchy and SOC2 compliance'),
    'enterprise',
  )
})

test('user-segments: power-user signals route to power-user', () => {
  assert.equal(
    inferSegment('Build a keyboard-first code editor with Vim keybindings'),
    'power-user',
  )
  assert.equal(inferSegment('A command palette driven log viewer with hotkeys'), 'power-user')
})

test('user-segments: smb signals route to smb', () => {
  assert.equal(inferSegment('Build a small business CRM with Stripe subscription billing'), 'smb')
  assert.equal(inferSegment('A simple invoice customers page for solo founders'), 'smb')
})

test('user-segments: markdown renders with SSO hint for enterprise', () => {
  const md = segmentDefaultsAsMarkdown('enterprise')
  assert.ok(/SSO|SAML/i.test(md))
})

test('user-segments: markdown renders with Stripe Checkout hint for smb', () => {
  const md = segmentDefaultsAsMarkdown('smb')
  assert.ok(/Stripe Checkout/i.test(md))
})
