import Link from 'next/link'
import type { Bundle } from '../lib/catalog'

interface Props {
  bundle: Bundle
}

export function BundleCard({ bundle }: Props) {
  const visibleTags = bundle.tags.slice(0, 4)
  return (
    <Link href={`/bundles/${bundle.id}`} aria-label={`View ${bundle.id} details`}>
      <article className='mp-card'>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <h3 className='mp-card-title'>{bundle.id}</h3>
          <span className={`mp-badge ${bundle.isMultiAgent ? 'mp-badge-multi' : 'mp-badge-single'}`}>
            {bundle.isMultiAgent ? 'multi-agent' : 'single-agent'}
          </span>
        </header>
        <p className='mp-card-desc'>{bundle.description}</p>
        <div>
          {visibleTags.map((t) => (
            <span key={t} className='mp-tag'>
              {t}
            </span>
          ))}
        </div>
        <footer className='mp-muted' style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span>{bundle.taxonomy.runtime}</span>
          <span>{bundle.taxonomy.surface}</span>
        </footer>
      </article>
    </Link>
  )
}
