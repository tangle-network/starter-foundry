// Types

export interface Position {
  account: string
  market: string
  collateral: number
  debt: number
  liquidationThreshold: number
}

export interface PriceData {
  asset: string
  price: number
  confidence: number
  timestamp: number
}

export interface LiquidationParams {
  account: string
  market: string
  debtToRepay: number
  collateralToSeize: number
  incentive: number
  programId: string
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
}

// Implementation

export function checkLiquidatable(
  position: Position,
  priceData: PriceData,
): { liquidatable: boolean; healthFactor: number; shortfall: number } {
  const collateralValue = position.collateral * priceData.price
  const healthFactor = position.debt > 0
    ? collateralValue / (position.debt * position.liquidationThreshold)
    : Infinity

  const shortfall = healthFactor < 1
    ? position.debt - collateralValue / position.liquidationThreshold
    : 0

  return {
    liquidatable: healthFactor < 1,
    healthFactor,
    shortfall,
  }
}

export function buildLiquidationTx(
  position: Position,
  market: string,
  priceData: PriceData,
): LiquidationParams {
  const { shortfall } = checkLiquidatable(position, priceData)

  // Liquidate up to 50% of the debt (close factor)
  const closeFactor = 0.5
  const debtToRepay = Math.min(position.debt * closeFactor, position.debt)

  // Liquidation incentive: 5% bonus on collateral seized
  const incentive = 0.05
  const collateralToSeize = (debtToRepay / priceData.price) * (1 + incentive)

  return {
    account: position.account,
    market,
    debtToRepay,
    collateralToSeize,
    incentive,
    programId: market,
    keys: [
      { pubkey: position.account, isSigner: false, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      // Liquidator account would be added at signing time
    ],
  }
}

export function calculatePriority(healthFactor: number, positionSize: number): number {
  // Lower health factor = higher priority (more urgent)
  // Larger position = higher priority (more profitable)
  if (healthFactor >= 1) return 0

  const urgency = 1 / Math.max(healthFactor, 0.01)
  const sizeScore = Math.log10(Math.max(positionSize, 1))

  // Weighted combination: urgency matters more than size
  return urgency * 0.7 + sizeScore * 0.3
}
