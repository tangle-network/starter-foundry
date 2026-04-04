// Types

export interface OHLCV {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Indicators {
  smaFast: number[]
  smaSlow: number[]
  rsi?: number
  atr?: number
}

export interface Signal {
  action: 'buy' | 'sell' | 'hold'
  confidence: number
  reason: string
}

export interface Position {
  size: number
  stopLoss: number
  takeProfit: number
}

export interface Portfolio {
  equity: number
  openPositions: number
  maxPositions: number
}

// Implementation

export function crossover(fast: number[], slow: number[]): 'bullish' | 'bearish' | 'none' {
  if (fast.length < 2 || slow.length < 2) return 'none'

  const prevFast = fast[fast.length - 2]
  const currFast = fast[fast.length - 1]
  const prevSlow = slow[slow.length - 2]
  const currSlow = slow[slow.length - 1]

  if (prevFast <= prevSlow && currFast > currSlow) return 'bullish'
  if (prevFast >= prevSlow && currFast < currSlow) return 'bearish'
  return 'none'
}

export function evaluateSignal(candle: OHLCV, indicators: Indicators): Signal {
  const cross = crossover(indicators.smaFast, indicators.smaSlow)

  // RSI extremes override crossover signals
  if (indicators.rsi !== undefined) {
    if (indicators.rsi > 80) {
      return { action: 'sell', confidence: 0.7, reason: `RSI overbought at ${indicators.rsi.toFixed(1)}` }
    }
    if (indicators.rsi < 20) {
      return { action: 'buy', confidence: 0.7, reason: `RSI oversold at ${indicators.rsi.toFixed(1)}` }
    }
  }

  // Crossover signals
  if (cross === 'bullish') {
    const confidence = indicators.rsi !== undefined
      ? 0.5 + (50 - Math.min(indicators.rsi, 50)) / 100
      : 0.5
    return { action: 'buy', confidence: Math.min(confidence, 1), reason: 'Bullish SMA crossover' }
  }

  if (cross === 'bearish') {
    const confidence = indicators.rsi !== undefined
      ? 0.5 + (Math.max(indicators.rsi, 50) - 50) / 100
      : 0.5
    return { action: 'sell', confidence: Math.min(confidence, 1), reason: 'Bearish SMA crossover' }
  }

  // Trend confirmation: price relative to slow SMA
  const slowSma = indicators.smaSlow[indicators.smaSlow.length - 1]
  if (slowSma !== undefined) {
    const deviation = (candle.close - slowSma) / slowSma
    if (Math.abs(deviation) > 0.02) {
      return {
        action: 'hold',
        confidence: 0.3,
        reason: `Price ${deviation > 0 ? 'above' : 'below'} slow SMA by ${(Math.abs(deviation) * 100).toFixed(1)}%, awaiting crossover`,
      }
    }
  }

  return { action: 'hold', confidence: 0.1, reason: 'No clear signal' }
}

export function calculatePosition(
  signal: Signal,
  portfolio: Portfolio,
  riskPct: number,
): Position | null {
  if (signal.action === 'hold') return null
  if (portfolio.openPositions >= portfolio.maxPositions) return null

  const clampedRisk = Math.max(0.001, Math.min(riskPct, 0.1))
  const riskAmount = portfolio.equity * clampedRisk

  // ATR-based stop or default 2% stop
  const stopPct = 0.02
  const size = riskAmount / stopPct

  // Scale by confidence
  const adjustedSize = size * signal.confidence

  const stopLoss = signal.action === 'buy'
    ? 1 - stopPct
    : 1 + stopPct

  // 2:1 reward/risk ratio
  const takeProfit = signal.action === 'buy'
    ? 1 + stopPct * 2
    : 1 - stopPct * 2

  return {
    size: Math.round(adjustedSize * 100) / 100,
    stopLoss,
    takeProfit,
  }
}
