// TraceList — sidebar list with date / family / status filters. Selecting a
// row navigates to /traces/:id; the active route id is highlighted.

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { AgentEvalTrace } from '../lib/traces'

export interface TraceListProps {
  traces: AgentEvalTrace[]
}

const STATUSES = ['all', 'pass', 'fail', 'scaffold', 'error'] as const

export function TraceList({ traces }: TraceListProps) {
  const { id: activeId } = useParams<{ id?: string }>()
  const [query, setQuery] = useState('')
  const [date, setDate] = useState<string>('all')
  const [family, setFamily] = useState<string>('all')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all')

  const dates = useMemo(() => {
    const set = new Set(traces.map((t) => t.runDate))
    return ['all', ...[...set].sort().reverse()]
  }, [traces])
  const families = useMemo(() => {
    const set = new Set(traces.map((t) => t.family))
    return ['all', ...[...set].sort()]
  }, [traces])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return traces.filter((t) => {
      if (date !== 'all' && t.runDate !== date) return false
      if (family !== 'all' && t.family !== family) return false
      if (status !== 'all' && t.status !== status) return false
      if (q && !`${t.id} ${t.family} ${t.seed}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [traces, query, date, family, status])

  return (
    <div>
      <h2>Filter</h2>
      <div className='filter-row'>
        <input
          type='search'
          placeholder='search id / family / seed'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className='filter-row'>
        <select value={date} onChange={(e) => setDate(e.target.value)}>
          {dates.map((d) => (
            <option key={d} value={d}>
              {d === 'all' ? 'All dates' : d}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All status' : s}
            </option>
          ))}
        </select>
      </div>
      <div className='filter-row'>
        <select value={family} onChange={(e) => setFamily(e.target.value)}>
          {families.map((f) => (
            <option key={f} value={f}>
              {f === 'all' ? 'All families' : f}
            </option>
          ))}
        </select>
      </div>
      <h2>Traces ({filtered.length})</h2>
      {filtered.length === 0 && <div className='empty-state'>No traces match.</div>}
      {filtered.map((t) => (
        <Link
          key={t.id}
          to={`/traces/${encodeURIComponent(t.id)}`}
          className={`trace-row ${activeId === t.id ? 'active' : ''}`}
        >
          <div>
            {t.family}
            <span className={`status ${t.status === 'pass' ? 'pass' : t.status === 'scaffold' ? 'scaffold' : 'fail'}`}>
              {t.status}
            </span>
          </div>
          <div className='meta'>
            {t.runDate} · {t.seed}
          </div>
        </Link>
      ))}
    </div>
  )
}
