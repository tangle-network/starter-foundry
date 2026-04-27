// ScoreRadar — recharts RadarChart wrapper. Receives a normalised
// dimension array (every value in [0..1], lower-is-better dims pre-inverted
// by radarData) and renders a single polygon. Pass two `series` to overlay
// two runs in the diff view.

import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

export interface RadarSeries {
  name: string
  /** Stroke + fill base colour. */
  color: string
  data: Array<{ dim: string; value: number; raw: number }>
}

export interface ScoreRadarProps {
  series: RadarSeries[]
  height?: number
}

/**
 * Recharts requires a single dataset keyed by dimension. We merge the per-series
 * arrays here so each row looks like { dim, [seriesName]: value, ... }.
 */
function mergeSeries(series: RadarSeries[]): Array<Record<string, string | number>> {
  const dims = new Set<string>()
  for (const s of series) for (const row of s.data) dims.add(row.dim)
  const merged: Array<Record<string, string | number>> = []
  for (const dim of dims) {
    const row: Record<string, string | number> = { dim }
    for (const s of series) {
      const found = s.data.find((d) => d.dim === dim)
      row[s.name] = found?.value ?? 0
    }
    merged.push(row)
  }
  return merged
}

export function ScoreRadar({ series, height = 320 }: ScoreRadarProps) {
  if (series.length === 0 || series.every((s) => s.data.length === 0)) {
    return <div className='empty-state'>No scoring dimensions to plot.</div>
  }
  const merged = mergeSeries(series)
  return (
    <ResponsiveContainer width='100%' height={height}>
      <RadarChart data={merged} outerRadius='75%'>
        <PolarGrid stroke='#2a3140' />
        <PolarAngleAxis dataKey='dim' tick={{ fill: '#8a93a3', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 1]} tick={{ fill: '#8a93a3', fontSize: 10 }} angle={30} />
        <Tooltip
          contentStyle={{ background: '#161b25', border: '1px solid #232a36', color: '#e6e8ec', fontSize: 12 }}
          formatter={(value: number) => `${(Number(value) * 100).toFixed(1)}%`}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8a93a3' }} />
        {series.map((s) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}
