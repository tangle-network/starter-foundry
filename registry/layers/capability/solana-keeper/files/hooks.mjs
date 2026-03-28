export function beforeCycle(lastTick) {
  console.log(`[keeper] evaluating oracle and liquidation state for ${lastTick.symbol}`);
}

export function afterCycle(lastTick) {
  console.log(`[keeper] completed keeper cycle for ${lastTick.symbol} at ${lastTick.price}`);
}
