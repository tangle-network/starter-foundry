'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

interface SimpleChartProps {
  title?: string
  data: Array<{ name: string; value: number; [key: string]: unknown }>
  type?: 'line' | 'bar' | 'area'
  height?: number
  dataKeys?: string[]
}

export function SimpleChart({
  title,
  data,
  type = 'line',
  height = 300,
  dataKeys,
}: SimpleChartProps) {
  const keys = dataKeys ?? ['value']

  const renderChart = () => {
    const sharedProps = { data, margin: { top: 8, right: 8, bottom: 0, left: -16 } }
    const axisProps = {
      xAxis: <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />,
      yAxis: <YAxis tickLine={false} axisLine={false} className="text-xs" />,
      grid: <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />,
      tooltip: <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />,
    }

    if (type === 'bar') {
      return (
        <BarChart {...sharedProps}>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          {keys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      )
    }

    if (type === 'area') {
      return (
        <AreaChart {...sharedProps}>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          {keys.map((key, i) => (
            <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.2} />
          ))}
        </AreaChart>
      )
    }

    return (
      <LineChart {...sharedProps}>
        {axisProps.grid}
        {axisProps.xAxis}
        {axisProps.yAxis}
        {axisProps.tooltip}
        {keys.map((key, i) => (
          <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    )
  }

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  )

  if (!title) return chart

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{chart}</CardContent>
    </Card>
  )
}
