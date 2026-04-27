// TraceDetail — per-trace timeline + score table + radar + artifact pane.
// Uses ui-adapter:blocks-renderer's parseBlocks/blocksToArtifacts to detect
// :::artifact-style blocks the run emitted into assistant content.

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { AgentEvalTrace } from '../lib/traces'
import { assistantText } from '../lib/traces'
import { formatScore, radarData } from '../lib/scoring'
import { ScoreRadar } from './ScoreRadar'
import { parseBlocks } from '../lib/parse-blocks'
import { blocksToArtifacts } from '../lib/blocks-to-artifacts'

export interface TraceDetailProps {
  traces: AgentEvalTrace[]
}

export function TraceDetail({ traces }: TraceDetailProps) {
  const { id } = useParams<{ id: string }>()
  const decodedId = id ? decodeURIComponent(id) : ''
  const trace = useMemo(() => traces.find((t) => t.id === decodedId), [traces, decodedId])

  const radar = useMemo(() => {
    if (!trace) return []
    return [{ name: trace.family, color: '#7aa2ff', data: radarData(trace.scores) }]
  }, [trace])

  const artifacts = useMemo(() => {
    if (!trace) return []
    const text = assistantText(trace)
    if (!text) return []
    return blocksToArtifacts(parseBlocks(text))
  }, [trace])

  if (!trace) {
    return (
      <div>
        <div className='crumbs'>
          <Link to='/traces'>← traces</Link>
        </div>
        <div className='empty-state'>Trace "{decodedId}" not found.</div>
      </div>
    )
  }

  const scoreEntries = Object.entries(trace.scores)

  return (
    <div>
      <div className='crumbs'>
        <Link to='/traces'>traces</Link> <span>/</span> <span>{trace.id}</span>
      </div>
      <h1 className='h-title'>
        {trace.family} <span className={`status ${trace.status === 'pass' ? 'pass' : trace.status === 'scaffold' ? 'scaffold' : 'fail'}`}>{trace.status}</span>
      </h1>
      <p className='h-sub'>
        seed <code>{trace.seed}</code> · run {trace.runDate} · {trace.wallMs ? `${trace.wallMs} ms` : 'no wall time'}
        {trace.error ? <> · <span style={{ color: '#ef6e6e' }}>error: {trace.error}</span></> : null}
      </p>

      <div className='score-grid'>
        <div>
          <table className='score-table'>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {scoreEntries.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ color: '#8a93a3' }}>
                    No score dimensions recorded for this trace.
                  </td>
                </tr>
              ) : (
                scoreEntries.map(([dim, raw]) => (
                  <tr key={dim}>
                    <td>{dim}</td>
                    <td>{formatScore(dim, raw)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div>
          <ScoreRadar series={radar} />
        </div>
      </div>

      {trace.phases && trace.phases.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a93a3' }}>
            Phases
          </h3>
          <table className='score-table'>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {trace.phases.map((p, i) => (
                <tr key={i}>
                  <td>{p.phase}</td>
                  <td className={p.ok ? 'delta-good' : 'delta-bad'}>{p.ok ? 'ok' : 'fail'}</td>
                  <td style={{ color: '#8a93a3' }}>{p.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a93a3', marginTop: 24 }}>
        Timeline ({trace.turns.length} turns)
      </h3>
      {trace.turns.length === 0 ? (
        <div className='empty-state'>This trace recorded no turns (likely a scaffold-only run).</div>
      ) : (
        <div className='timeline'>
          {trace.turns.map((turn) => (
            <div key={turn.idx} className={`turn role-${turn.role}`}>
              <div className='role'>{turn.role}</div>
              <div className='content'>{turn.content || <em style={{ color: '#8a93a3' }}>(empty)</em>}</div>
              {turn.toolCalls?.map((tc, i) => (
                <div key={i} className='tool-call'>
                  <strong>{tc.name}</strong>
                  <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify({ args: tc.args, result: tc.result }, null, 2)}
                  </pre>
                </div>
              ))}
              {(turn.latencyMs !== undefined || turn.tokens !== undefined) && (
                <div className='meta-line'>
                  {turn.latencyMs !== undefined && <span>{turn.latencyMs} ms</span>}
                  {turn.tokens !== undefined && <span>{turn.tokens} tokens</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {artifacts.length > 0 && (
        <div className='artifacts'>
          <h3>Artifacts ({artifacts.length})</h3>
          {artifacts.map((a) => (
            <div key={a.id} className='artifact-card'>
              <div className='title'>{a.title ?? a.kind}</div>
              <div className='body'>
                {a.kind === 'markdown' || a.kind === 'custom'
                  ? typeof a.content === 'string'
                    ? a.content
                    : '[react node]'
                  : JSON.stringify((a as { schema: unknown }).schema, null, 2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
