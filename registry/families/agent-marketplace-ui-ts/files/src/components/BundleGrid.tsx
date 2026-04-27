import type { Bundle } from '../lib/catalog'
import { BundleCard } from './BundleCard'

interface Props {
  bundles: Bundle[]
}

export function BundleGrid({ bundles }: Props) {
  if (bundles.length === 0) {
    return (
      <div className='mp-muted' style={{ padding: '48px 0', textAlign: 'center' }}>
        No bundles match the current filter.
      </div>
    )
  }
  return (
    <section aria-label='Bundle catalog' className='mp-grid'>
      {bundles.map((b) => (
        <BundleCard key={b.id} bundle={b} />
      ))}
    </section>
  )
}
