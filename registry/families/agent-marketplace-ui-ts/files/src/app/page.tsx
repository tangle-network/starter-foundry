// Catalog landing page. Server component reads CATALOG_REGISTRY_PATH and
// passes the full bundle list down to a client island that owns search +
// filter state. Server-side load keeps the initial render free of `'use
// client'` overhead and lets crawlers index the catalog.

import { loadCatalog, resolveRegistryPath } from '../lib/catalog'
import { CatalogClient } from './page-client'

export default async function CatalogPage() {
  let bundles
  let error: string | undefined
  try {
    bundles = await loadCatalog(resolveRegistryPath())
  } catch (err) {
    bundles = []
    error = err instanceof Error ? err.message : String(err)
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 className='mp-h1' style={{ fontSize: '1.25rem', marginBottom: 4 }}>
          {bundles.length} agent bundles
        </h2>
        <p className='mp-muted'>
          Browse single-agent and multi-agent bundles. Click a card to preview
          AGENTS.md and walk through deploy.
        </p>
      </div>
      {error && (
        <div className='mp-card' role='alert' style={{ borderColor: 'hsl(0 84% 60%)', marginBottom: 16 }}>
          <strong>Catalog load failed.</strong>
          <p className='mp-muted' style={{ fontSize: '0.8125rem' }}>{error}</p>
        </div>
      )}
      <CatalogClient bundles={bundles} />
    </div>
  )
}
