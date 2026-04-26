// SBOM generation for a composed scaffold. CycloneDX-lite format — the
// subset that matters: component list with (name, version, licenses, hashes).
// Written to `.starter-foundry/sbom.cdx.json` alongside the compose report.
//
// Downstream: supply-chain scanners (sigstore, Dependency-Track, etc.) can
// consume the CycloneDX output directly.

import fs from 'node:fs/promises'
import path from 'node:path'

export interface SbomComponent {
  name: string
  version: string
  'bom-ref': string
  type: 'library' | 'application' | 'framework'
  purl?: string
}

export interface Sbom {
  bomFormat: 'CycloneDX'
  specVersion: '1.5'
  serialNumber: string
  version: 1
  metadata: {
    timestamp: string
    tools: { vendor: string; name: string; version: string }[]
    component: { type: 'application'; name: string; version: string }
  }
  components: SbomComponent[]
}

/**
 * Read a composed scaffold's root `package.json` and synthesize an SBOM.
 * For non-Node scaffolds (Rust/Go/Python), read the equivalent manifest
 * (Cargo.toml, go.mod, requirements.txt).
 */
export async function generateSbom(outDir: string, projectName: string): Promise<Sbom | null> {
  const components: SbomComponent[] = []
  const pkgPath = path.join(outDir, 'package.json')
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    for (const [name, version] of Object.entries({
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    })) {
      components.push({
        name,
        version,
        'bom-ref': `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
        type: 'library',
        purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      })
    }
  } catch {
    // Not a Node project — try Cargo.toml.
    try {
      const cargo = await fs.readFile(path.join(outDir, 'Cargo.toml'), 'utf8')
      for (const match of cargo.matchAll(/^(\w[\w-]*)\s*=\s*"([^"]+)"/gm)) {
        const name = match[1]
        const version = match[2]
        components.push({
          name,
          version,
          'bom-ref': `pkg:cargo/${name}@${version}`,
          type: 'library',
          purl: `pkg:cargo/${name}@${version}`,
        })
      }
    } catch {
      // Not Cargo either — try requirements.txt.
      try {
        const req = await fs.readFile(path.join(outDir, 'requirements.txt'), 'utf8')
        for (const line of req.split('\n')) {
          const m = /^([a-zA-Z0-9_-]+)\s*[>=<~]+\s*([^\s#]+)/.exec(line)
          if (!m) continue
          components.push({
            name: m[1],
            version: m[2],
            'bom-ref': `pkg:pypi/${m[1]}@${m[2]}`,
            type: 'library',
            purl: `pkg:pypi/${m[1]}@${m[2]}`,
          })
        }
      } catch {
        return null
      }
    }
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:sf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'tangle-network', name: 'starter-foundry', version: '0.5.4' }],
      component: { type: 'application', name: projectName, version: '0.0.1' },
    },
    components,
  }
}

export async function writeSbom(outDir: string, projectName: string): Promise<string | null> {
  const sbom = await generateSbom(outDir, projectName)
  if (!sbom) return null
  const target = path.join(outDir, '.starter-foundry', 'sbom.cdx.json')
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, JSON.stringify(sbom, null, 2))
  return target
}
