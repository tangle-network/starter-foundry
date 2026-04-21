// License-awareness for composed scaffolds. Flags GPL / AGPL / SSPL deps
// when the caller declares `commercialIntent: true`. Doesn't block compose
// — surfaces advice in the ComposeResult so the consumer can decide.

import fs from 'node:fs/promises'
import path from 'node:path'

// Conservative block list — scopes NOT to ship in a commercial scaffold
// without the user's explicit acknowledgement.
const COPYLEFT_LICENSES = new Set(['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'])

export interface LicenseFlag {
  package: string
  license: string
  severity: 'warn' | 'block'
}

// Best-effort package-license lookup. For the hot path, we rely on the
// consumer's node_modules/<pkg>/package.json license field (read once,
// cached). For the deterministic dev path, we use a tiny hand-curated
// override map + default to 'unknown'.
const KNOWN_LICENSES: Record<string, string> = {
  // (fill in over time from observed audit results — this is a seed).
  'vllm': 'Apache-2.0',
  'stripe': 'MIT',
  'ethers': 'MIT',
  'viem': 'MIT',
  'react': 'MIT',
  'next': 'MIT',
  'svelte': 'MIT',
  'vue': 'MIT',
  'langchain': 'MIT',
  '@mysten/sui': 'Apache-2.0',
}

async function readPackageLicense(outDir: string, name: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(outDir, 'node_modules', name, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { license?: string | { type?: string } }
    if (typeof pkg.license === 'string') return pkg.license
    if (pkg.license && typeof pkg.license === 'object' && 'type' in pkg.license) return pkg.license.type ?? null
    return null
  } catch { return null }
}

export async function scanLicenses(args: { outDir: string; commercialIntent: boolean }): Promise<LicenseFlag[]> {
  const flags: LicenseFlag[] = []
  let pkg
  try {
    pkg = JSON.parse(await fs.readFile(path.join(args.outDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
  } catch { return flags }

  for (const name of Object.keys(pkg.dependencies ?? {})) {
    const license = (await readPackageLicense(args.outDir, name)) ?? KNOWN_LICENSES[name] ?? 'unknown'
    if (COPYLEFT_LICENSES.has(license)) {
      flags.push({
        package: name,
        license,
        severity: args.commercialIntent ? 'block' : 'warn',
      })
    }
  }
  return flags
}
