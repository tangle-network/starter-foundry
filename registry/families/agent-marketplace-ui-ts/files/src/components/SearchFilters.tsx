'use client'

import type { FilterState } from '../lib/search'

interface Props {
  filter: FilterState
  surfaces: string[]
  onChange: (next: FilterState) => void
}

export function SearchFilters({ filter, surfaces, onChange }: Props) {
  const toggleSurface = (s: string) => {
    const next = filter.surfaces.includes(s)
      ? filter.surfaces.filter((x) => x !== s)
      : [...filter.surfaces, s]
    onChange({ ...filter, surfaces: next })
  }
  return (
    <div className='mp-filters' role='search'>
      <input
        type='search'
        placeholder='Search bundles by name, tag, or description'
        value={filter.query}
        onChange={(e) => onChange({ ...filter, query: e.target.value })}
        className='mp-input'
        style={{ flex: '1 1 280px', maxWidth: 480 }}
        aria-label='Search bundles'
      />
      <select
        value={filter.shape}
        onChange={(e) =>
          onChange({ ...filter, shape: e.target.value as FilterState['shape'] })
        }
        className='mp-input'
        style={{ width: 'auto' }}
        aria-label='Filter by agent shape'
      >
        <option value='all'>All shapes</option>
        <option value='single-agent'>Single-agent</option>
        <option value='multi-agent'>Multi-agent</option>
      </select>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {surfaces.map((s) => {
          const active = filter.surfaces.includes(s)
          return (
            <button
              key={s}
              type='button'
              onClick={() => toggleSurface(s)}
              aria-pressed={active}
              className={`mp-tag mp-button ${active ? '' : 'mp-button-secondary'}`}
              style={{ padding: '4px 10px' }}
            >
              {s}
            </button>
          )
        })}
      </div>
    </div>
  )
}
