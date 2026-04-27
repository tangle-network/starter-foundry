// RunDiff — pick two traces, render side-by-side score deltas, with the
// winner highlighted per dimension. Uses radarData() to overlay both runs on
// one chart for at-a-glance comparison.

import { useMemo, useState } from 'react'
import type { AgentEvalTrace } from '../lib/traces'
import { diffScores, formatScore, radarData } from '../lib/scoring'
import { ScoreRadar } from './ScoreRadar'

export interface RunDiffProps {
  traces: AgentEvalTrace[]
}

export function RunDiff({ traces }: RunDiffProps) {
  const sorted = useMemo(() => [...traces].sort((a, b) => (a.id < b.id ? 1 : -1)), [traces])
  const [aId, setAId] = useState<string>(sorted[0]?.id ?? '')
  const [bId, setBId] = useState<string>(sorted[1]?.id ?? sorted[0]?.id ?? '')

  const a = sorted.find((t) => t.id === aId)
  const b = sorted.find((t) => t.id === bId)

  const diff = useMemo(() => (a && b ? diffScores(a, b) : null), [a, b])

  const radar = useMemo(() => {
    const series: { name: string; color: string; data: Array<{ dim: string; value: number; raw: number }> }[] = []
    if (a) series.push({ name: a.id, color: '#7aa2ff', data: radarData(a.scores) })
    if (b) series.push({ name: b.id, color: '#5fd28a', data: radarData(b.scores) })
    return series
  }, [a, b])

  if (sorted.length < 2) {
    return (
      <div>
        <h1 className='h-title'>Compare runs</h1>
        <div className='empty-state'>Need at least two traces loaded to diff. Currently {sorted.length}.</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className='h-title'>Compare runs</h1>
      <div className='compare-pickers'>
        <select value={aId} onChange={(e) => setAId(e.target.value)}>
          {sorted.map((t) => (
            <option key={t.id} value={t.id}>
              A — {t.family} · {t.id}
            </option>
          ))}
        </select>
        <select value={bId} onChange={(e) => setBId(e.target.value)}>
          {sorted.map((t) => (
            <option key={t.id} value={t.id}>
              B — {t.family} · {t.id}
            </option>
          ))}
        </select>
      </div>

      <ScoreRadar series={radar} height={360} />

      {diff && (
        <table className='score-table' style={{ marginTop: 24 }}>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>A ({a?.id})</th>
              <th>B ({b?.id})</th>
              <th>Δ</th>
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(diff).map(([dim, row]) => (
              <tr key={dim}>
                <td>{dim}</td>
                <td>{formatScore(dim, row.a)}</td>
                <td>{formatScore(dim, row.b)}</td>
                <td className={row.delta === 0 ? '' : row.delta > 0 ? 'delta-good' : 'delta-bad'}>
                  {row.delta > 0 ? '+' : ''}
                  {formatScore(dim, row.delta)}
                </td>
                <td>{row.winner === 'tie' ? '—' : row.winner.toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
