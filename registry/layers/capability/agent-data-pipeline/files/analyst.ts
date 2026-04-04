// Types

export interface SchemaField {
  name: string
  type: 'number' | 'string' | 'boolean' | 'null' | 'mixed'
  nullRate: number
  uniqueCount: number
  sampleValues: unknown[]
}

export interface NumberStats {
  min: number
  max: number
  mean: number
  nullCount: number
}

export interface StringStats {
  topValues: Array<{ value: string; count: number }>
  avgLength: number
  nullCount: number
}

export type ColumnStats = { type: 'number'; stats: NumberStats } | { type: 'string'; stats: StringStats }

export interface AnalysisSummary {
  rowCount: number
  columnCount: number
  columns: Array<SchemaField & { stats: ColumnStats }>
}

// Implementation

function inferType(values: unknown[]): SchemaField['type'] {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '')
  if (nonNull.length === 0) return 'null'

  let numCount = 0
  let strCount = 0
  let boolCount = 0

  for (const v of nonNull) {
    if (typeof v === 'boolean') boolCount++
    else if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))) numCount++
    else strCount++
  }

  const total = nonNull.length
  if (numCount / total > 0.8) return 'number'
  if (boolCount / total > 0.8) return 'boolean'
  if (strCount / total > 0.8) return 'string'
  return 'mixed'
}

export function analyzeSchema(rows: Record<string, unknown>[]): SchemaField[] {
  if (rows.length === 0) return []

  const columnNames = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) columnNames.add(key)
  }

  return Array.from(columnNames).map((name) => {
    const values = rows.map((r) => r[name])
    const nullCount = values.filter((v) => v === null || v === undefined || v === '').length
    const uniqueValues = new Set(values.filter((v) => v !== null && v !== undefined && v !== ''))

    return {
      name,
      type: inferType(values),
      nullRate: values.length > 0 ? nullCount / values.length : 0,
      uniqueCount: uniqueValues.size,
      sampleValues: Array.from(uniqueValues).slice(0, 5),
    }
  })
}

export function generateSummary(schema: SchemaField[], rows: Record<string, unknown>[]): AnalysisSummary {
  const columns = schema.map((field) => {
    const values = rows.map((r) => r[field.name])
    const nullCount = values.filter((v) => v === null || v === undefined || v === '').length

    if (field.type === 'number') {
      const nums = values
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => !isNaN(n))

      const stats: NumberStats = nums.length > 0
        ? {
            min: Math.min(...nums),
            max: Math.max(...nums),
            mean: nums.reduce((s, n) => s + n, 0) / nums.length,
            nullCount,
          }
        : { min: 0, max: 0, mean: 0, nullCount }

      return { ...field, stats: { type: 'number' as const, stats } }
    }

    // String/mixed/boolean: frequency analysis
    const freq = new Map<string, number>()
    let totalLength = 0
    let strCount = 0

    for (const v of values) {
      if (v === null || v === undefined || v === '') continue
      const s = String(v)
      freq.set(s, (freq.get(s) ?? 0) + 1)
      totalLength += s.length
      strCount++
    }

    const topValues = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }))

    const stats: StringStats = {
      topValues,
      avgLength: strCount > 0 ? totalLength / strCount : 0,
      nullCount,
    }

    return { ...field, stats: { type: 'string' as const, stats } }
  })

  return {
    rowCount: rows.length,
    columnCount: schema.length,
    columns,
  }
}

export function buildQuery(question: string, schema: SchemaField[]): string {
  const lower = question.toLowerCase()
  const columnNames = schema.map((f) => f.name)
  const numericColumns = schema.filter((f) => f.type === 'number').map((f) => f.name)

  // Detect referenced columns
  const referencedCols = columnNames.filter((c) => lower.includes(c.toLowerCase()))
  const selectCols = referencedCols.length > 0 ? referencedCols : columnNames

  // Detect aggregation intent
  const wantsAvg = /average|avg|mean/.test(lower)
  const wantsSum = /total|sum/.test(lower)
  const wantsCount = /how many|count|number of/.test(lower)
  const wantsMax = /max|maximum|highest|largest|most/.test(lower)
  const wantsMin = /min|minimum|lowest|smallest|least/.test(lower)
  const wantsGroup = /by\s+(\w+)|per\s+(\w+)|group/.test(lower)

  // Detect grouping column
  let groupCol: string | null = null
  if (wantsGroup) {
    const groupMatch = lower.match(/(?:by|per|group\s+by)\s+(\w+)/)
    if (groupMatch) {
      const candidate = groupMatch[1]
      groupCol = columnNames.find((c) => c.toLowerCase() === candidate) ?? null
    }
  }

  // Build pseudo-SQL
  const aggTarget = numericColumns.find((c) => referencedCols.includes(c)) ?? numericColumns[0] ?? selectCols[0]

  let select = selectCols.join(', ')
  if (wantsAvg) select = `AVG(${aggTarget})`
  else if (wantsSum) select = `SUM(${aggTarget})`
  else if (wantsCount) select = 'COUNT(*)'
  else if (wantsMax) select = `MAX(${aggTarget})`
  else if (wantsMin) select = `MIN(${aggTarget})`

  if (groupCol && (wantsAvg || wantsSum || wantsCount || wantsMax || wantsMin)) {
    select = `${groupCol}, ${select}`
  }

  let query = `SELECT ${select} FROM data`

  // Simple WHERE detection
  const whereMatch = lower.match(/where\s+(\w+)\s*(=|>|<|>=|<=)\s*['"]?(\w+)['"]?/)
  if (whereMatch) {
    const [, col, op, val] = whereMatch
    const realCol = columnNames.find((c) => c.toLowerCase() === col) ?? col
    query += ` WHERE ${realCol} ${op} '${val}'`
  }

  if (groupCol) query += ` GROUP BY ${groupCol}`

  // Detect ordering
  if (/top|highest|largest|most/.test(lower)) query += ` ORDER BY ${aggTarget} DESC LIMIT 10`
  else if (/bottom|lowest|smallest|least/.test(lower)) query += ` ORDER BY ${aggTarget} ASC LIMIT 10`

  return query
}
