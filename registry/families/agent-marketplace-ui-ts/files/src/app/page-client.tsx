'use client'

import { useMemo, useState } from 'react'
import { BundleGrid } from '../components/BundleGrid'
import { SearchFilters } from '../components/SearchFilters'
import type { Bundle } from '../lib/catalog'
import { emptyFilter, searchBundles, uniqueSurfaces } from '../lib/search'

interface Props {
  bundles: Bundle[]
}

export function CatalogClient({ bundles }: Props) {
  const [filter, setFilter] = useState(emptyFilter())
  const surfaces = useMemo(() => uniqueSurfaces(bundles), [bundles])
  const visible = useMemo(() => searchBundles(bundles, filter), [bundles, filter])
  return (
    <>
      <SearchFilters filter={filter} surfaces={surfaces} onChange={setFilter} />
      <p className='mp-muted' style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        Showing {visible.length} of {bundles.length}
      </p>
      <BundleGrid bundles={visible} />
    </>
  )
}
