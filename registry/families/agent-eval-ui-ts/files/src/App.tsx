// App — three views (list / detail / compare) wired to react-router. Trace
// load is one-shot at mount via the dev-server middleware in vite.config.ts;
// production deployments should swap that for a static JSON endpoint or a
// purpose-built API (see README).

import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TraceList } from './components/TraceList'
import { TraceDetail } from './components/TraceDetail'
import { RunDiff } from './components/RunDiff'
import { ScoreRadar } from './components/ScoreRadar'
import { aggregateScores, radarData } from './lib/scoring'
import type { AgentEvalTrace } from './lib/traces'
import { loadTraces } from './lib/traces'

const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) ?? '{{appName}}'

interface LoadState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  traces: AgentEvalTrace[]
  error?: string
}

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'idle', traces: [] })
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', traces: [] })
    loadTraces()
      .then((traces) => {
        if (!cancelled) setState({ status: 'ready', traces })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            traces: [],
            error: err instanceof Error ? err.message : String(err),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className='app-shell'>
      <aside className='sidebar'>
        <div style={{ marginBottom: 12 }}>
          <Link to='/traces' style={{ fontSize: 16, fontWeight: 600, color: '#e6e8ec' }}>
            {APP_NAME}
          </Link>
          <div style={{ fontSize: 11, color: '#8a93a3', marginTop: 2 }}>agent-eval UI</div>
        </div>
        <nav style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Link to='/traces' className={location.pathname.startsWith('/traces') ? 'trace-row active' : 'trace-row'}>
            Traces
          </Link>
          <Link to='/compare' className={location.pathname.startsWith('/compare') ? 'trace-row active' : 'trace-row'}>
            Compare
          </Link>
        </nav>
        {state.status === 'loading' && <div className='empty-state'>Loading…</div>}
        {state.status === 'error' && (
          <div className='empty-state' style={{ color: '#ef6e6e' }}>
            Failed to load traces: {state.error}
          </div>
        )}
        {state.status === 'ready' && <TraceList traces={state.traces} />}
      </aside>
      <main className='main'>
        <Routes>
          <Route path='/' element={<Navigate to='/traces' replace />} />
          <Route path='/traces' element={<Overview state={state} />} />
          <Route path='/traces/:id' element={<TraceDetail traces={state.traces} />} />
          <Route path='/compare' element={<RunDiff traces={state.traces} />} />
          <Route path='*' element={<div className='empty-state'>Not found.</div>} />
        </Routes>
      </main>
    </div>
  )
}

function Overview({ state }: { state: LoadState }) {
  if (state.status === 'loading') return <div className='empty-state'>Loading traces…</div>
  if (state.status === 'error') {
    return (
      <div className='empty-state' style={{ color: '#ef6e6e' }}>
        {state.error}
      </div>
    )
  }
  if (state.traces.length === 0) {
    return (
      <div>
        <h1 className='h-title'>No traces yet</h1>
        <p className='h-sub'>
          Set <code>AGENT_EVAL_TRACES_DIR</code> in <code>.env</code> to a directory containing agent-eval output (e.g.{' '}
          <code>.evolve/agent-eval</code>) and reload.
        </p>
      </div>
    )
  }

  const aggregate = aggregateScores(state.traces)
  const passing = state.traces.filter((t) => t.status === 'pass').length
  const failing = state.traces.filter((t) => t.status === 'fail' || t.status === 'error').length
  const scaffolds = state.traces.filter((t) => t.status === 'scaffold').length

  return (
    <div>
      <h1 className='h-title'>Run overview</h1>
      <p className='h-sub'>
        {state.traces.length} traces · {passing} passing · {failing} failing · {scaffolds} scaffold-only
      </p>
      <div className='score-grid'>
        <table className='score-table'>
          <thead>
            <tr>
              <th>Dimension (mean)</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(aggregate).map(([dim, value]) => (
              <tr key={dim}>
                <td>{dim}</td>
                <td>{formatNumber(dim, value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ScoreRadar series={[{ name: 'aggregate', color: '#7aa2ff', data: radarData(aggregate) }]} />
      </div>
      <p className='h-sub'>Pick a trace from the sidebar to drill in, or open Compare to diff two runs.</p>
    </div>
  )
}

function formatNumber(dim: string, raw: number): string {
  if (!Number.isFinite(raw)) return '—'
  if (dim === 'latencyP95') return `${Math.round(raw)} ms`
  if (dim === 'costUsd') return `$${raw.toFixed(4)}`
  return `${(raw * 100).toFixed(1)}%`
}
