import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchAgents } from '../lib/api'
import type { AgentSummary } from '../../shared/schema'
import { ChatPanel } from '../components/ChatPanel'
import { TenantBadge } from '../components/TenantBadge'

export function AgentInspector() {
  const { id } = useParams<{ id: string }>()
  const [meta, setMeta] = useState<AgentSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      const res = await fetchAgents()
      if (cancelled) return
      if (!res.ok) {
        setError(res.error)
        return
      }
      const found = res.value.agents.find((a) => a.id === id) ?? null
      if (!found) setError(`unknown agent: ${id}`)
      setMeta(found)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return <p>Missing agent id.</p>

  return (
    <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', gap: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Link to='/admin'>← back</Link>
          <h2 style={{ margin: '0.25rem 0 0' }}>{meta?.name ?? id}</h2>
          {meta ? <small style={{ color: 'var(--muted)' }}>{meta.description}</small> : null}
        </div>
        <TenantBadge />
      </header>
      {error ? <div className='error-banner'>{error}</div> : null}
      <ChatPanel agentId={id} />
    </section>
  )
}
