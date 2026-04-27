// Bundle detail page. Server-renders the manifest summary + AGENTS.md
// preview. The "Deploy" CTA links to /deploy/[id] where the guided flow
// lives — keeps detail-view DOM simple and lets the deploy flow own its
// own form state.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentsMdPreview } from '../../../components/AgentsMdPreview'
import { loadBundleDetail, resolveRegistryPath } from '../../../lib/catalog'

interface Params {
  params: { id: string }
}

export default async function BundleDetailPage({ params }: Params) {
  const bundle = await loadBundleDetail(resolveRegistryPath(), params.id)
  if (!bundle) notFound()

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href='/' className='mp-muted' style={{ fontSize: '0.875rem' }}>
          ← All bundles
        </Link>
      </p>
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className='mp-h1'>{bundle.id}</h1>
          <p className='mp-muted' style={{ marginTop: 4 }}>
            {bundle.description}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <span className={`mp-badge ${bundle.isMultiAgent ? 'mp-badge-multi' : 'mp-badge-single'}`}>
            {bundle.isMultiAgent ? 'multi-agent' : 'single-agent'}
          </span>
          <Link href={`/deploy/${bundle.id}`} className='mp-button'>
            Deploy this bundle →
          </Link>
        </div>
      </header>

      <section className='mp-card' style={{ marginBottom: 24 }}>
        <h2 className='mp-h2'>Manifest summary</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontSize: '0.875rem' }}>
          <dt className='mp-muted'>language</dt>
          <dd>{bundle.taxonomy.language}</dd>
          <dt className='mp-muted'>runtime</dt>
          <dd>{bundle.taxonomy.runtime}</dd>
          <dt className='mp-muted'>surface</dt>
          <dd>{bundle.taxonomy.surface}</dd>
          <dt className='mp-muted'>tags</dt>
          <dd>
            {bundle.tags.map((t) => (
              <span key={t} className='mp-tag'>
                {t}
              </span>
            ))}
          </dd>
          {bundle.tier1Keywords.length > 0 && (
            <>
              <dt className='mp-muted'>tier1 keywords</dt>
              <dd>
                {bundle.tier1Keywords.map((k) => (
                  <span key={k} className='mp-tag'>
                    {k}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </section>

      <AgentsMdPreview bundle={bundle} />
    </div>
  )
}
