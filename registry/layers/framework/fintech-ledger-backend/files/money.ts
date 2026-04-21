import Decimal from 'decimal.js'

// Money always flows through Decimal. Everywhere a numeric string enters
// from the outside world, it goes through `m(...)`. Everywhere it leaves,
// it's `.toFixed(4)` so NUMERIC storage is byte-stable.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN })

export function m(raw: string | number | Decimal): Decimal {
  if (raw instanceof Decimal) return raw
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) throw new Error('invalid amount (non-finite)')
    // Funnel through string to avoid IEEE-754 artifacts from float->Decimal.
    return new Decimal(raw.toString())
  }
  if (typeof raw === 'string') {
    if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`invalid amount string: ${raw}`)
    return new Decimal(raw)
  }
  throw new Error('unsupported amount type')
}

export function sum(values: Iterable<Decimal>): Decimal {
  let total = new Decimal(0)
  for (const v of values) total = total.plus(v)
  return total
}

export function toDbString(value: Decimal): string {
  // 4 scale matches the NUMERIC(20,4) column. HALF_EVEN (banker's rounding)
  // minimizes drift under repeated rounding.
  return value.toFixed(4, Decimal.ROUND_HALF_EVEN)
}
