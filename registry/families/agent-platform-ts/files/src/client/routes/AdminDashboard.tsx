import { useEffect, useState } from 'react'
import { fetchAgents, fetchHealth } from '../lib/api'
import type { AgentSummary, HealthResponse } from '../../shared/schema'
import { AgentList } from '../components/AgentList'
import { TenantBadge } from '../components/TenantBadge'

export function AdminDashboard() {
  const [agents, setAgents] = useState<AgentSummary[] | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const [a, h] = await Promise.all([fetchAgents(), fetchHealth()])
      if (cancelled) return
      if (a.ok) setAgents(a.value.agents)
      else setError(`agents: ${a.error}`)
      if (h.ok) setHealth(h.value)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Agents</h2>
          {health ? (
            <small style={{ color: 'var(--muted)' }}>
              status: {health.status} · packs: {health.packCount} · router:{' '}
              {health.routerReachable ? 'reachable' : 'down'}
            </small>
          ) : null}
        </div>
        <TenantBadge />
      </header>
      {error ? <div className='error-banner'>{error}</div> : null}
      {loading ? <p>Loading…</p> : null}
      {agents ? <AgentList agents={agents} /> : null}
    </section>
  )
}
