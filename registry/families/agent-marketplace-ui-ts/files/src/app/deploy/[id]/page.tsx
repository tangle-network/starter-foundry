// Deploy flow page. Server resolves the bundle (so the deploy form has the
// real id + multi-agent flag); the DeployFlow component owns the interactive
// form state.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeployFlow } from '../../../components/DeployFlow'
import { loadCatalog, resolveRegistryPath } from '../../../lib/catalog'

interface Params {
  params: { id: string }
}

export default async function DeployPage({ params }: Params) {
  const bundles = await loadCatalog(resolveRegistryPath())
  const bundle = bundles.find((b) => b.id === params.id)
  if (!bundle) notFound()
  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href={`/bundles/${bundle.id}`} className='mp-muted' style={{ fontSize: '0.875rem' }}>
          ← Back to bundle
        </Link>
      </p>
      <DeployFlow bundle={bundle} />
    </div>
  )
}
