// media-manifest — emit deterministic brand assets + a public/media.manifest.json.
// SVG placeholders built from the BrandKit palette render immediately; real
// bitmap generation (DALL-E, Replicate, Modal) replaces SVG content in place
// without changing the manifest contract.

import fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ensureDir } from '../fs.js'
import type { BrandKit } from './index.js'

export interface MediaAsset {
  path: string
  purpose: 'logo' | 'logo-png' | 'hero-bg' | 'og' | 'favicon' | 'app-icon'
  spec: { width: number; height: number; format: 'svg' | 'png' | 'ico' }
}

export interface MediaManifest {
  schemaVersion: 1
  generatedAt: string
  assets: MediaAsset[]
  /** Fingerprint of the source BrandKit so callers can detect drift. */
  brandFingerprint: string
}

export interface GenerateMediaResult {
  manifest: MediaManifest
  files: Array<{ path: string; body: string }>
}

function initialsFor(kit: BrandKit): string {
  return kit.brandName
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function brandFingerprint(kit: BrandKit): string {
  return [
    kit.brandName,
    kit.palette.primary,
    kit.palette.accent,
    kit.palette.background,
    kit.typography.sans,
  ].join('|')
}

function logoSvg(kit: BrandKit, size: number): string {
  const init = initialsFor(kit) || 'S'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="hsl(${kit.palette.primary})"/>
  <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="hsl(${kit.palette.background})" font-family="${kit.typography.sans}" font-size="${Math.round(size * 0.42)}" font-weight="700">${init}</text>
</svg>
`
}

function heroBgSvg(kit: BrandKit, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${kit.palette.primary})" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="hsl(${kit.palette.accent})" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="hsl(${kit.palette.background})" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
</svg>
`
}

function ogSvg(kit: BrandKit): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="hsl(${kit.palette.background})"/>
  <rect x="0" y="530" width="1200" height="100" fill="hsl(${kit.palette.primary})"/>
  <text x="80" y="280" fill="hsl(${kit.palette.foreground})" font-family="${kit.typography.sans}" font-size="72" font-weight="700">${escapeXml(kit.brandName)}</text>
  <text x="80" y="360" fill="hsl(${kit.palette.foreground})" font-family="${kit.typography.sans}" font-size="32" font-weight="400" opacity="0.8">${escapeXml(kit.tagline)}</text>
</svg>
`
}

function faviconSvg(kit: BrandKit): string {
  return logoSvg(kit, 32)
}

function appIconSvg(kit: BrandKit): string {
  return logoSvg(kit, 512)
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  )
}

export function buildMediaManifest(kit: BrandKit): GenerateMediaResult {
  const assets: MediaAsset[] = [
    { path: 'public/logo.svg', purpose: 'logo', spec: { width: 256, height: 256, format: 'svg' } },
    { path: 'public/hero-bg.svg', purpose: 'hero-bg', spec: { width: 1920, height: 1080, format: 'svg' } },
    { path: 'public/og-image.svg', purpose: 'og', spec: { width: 1200, height: 630, format: 'svg' } },
    { path: 'public/favicon.svg', purpose: 'favicon', spec: { width: 32, height: 32, format: 'svg' } },
    { path: 'public/app-icon.svg', purpose: 'app-icon', spec: { width: 512, height: 512, format: 'svg' } },
  ]
  const files: Array<{ path: string; body: string }> = [
    { path: 'public/logo.svg', body: logoSvg(kit, 256) },
    { path: 'public/hero-bg.svg', body: heroBgSvg(kit, 1920, 1080) },
    { path: 'public/og-image.svg', body: ogSvg(kit) },
    { path: 'public/favicon.svg', body: faviconSvg(kit) },
    { path: 'public/app-icon.svg', body: appIconSvg(kit) },
  ]
  const manifest: MediaManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assets,
    brandFingerprint: brandFingerprint(kit),
  }
  files.push({ path: 'public/media.manifest.json', body: JSON.stringify(manifest, null, 2) + '\n' })
  return { manifest, files }
}

export async function generateMediaManifest(kit: BrandKit, outDir: string): Promise<GenerateMediaResult> {
  const result = buildMediaManifest(kit)
  for (const f of result.files) {
    const abs = join(outDir, f.path)
    await ensureDir(dirname(abs))
    await fs.writeFile(abs, f.body, 'utf8')
  }
  return result
}
