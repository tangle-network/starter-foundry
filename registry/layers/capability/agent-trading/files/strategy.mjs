export const strategy = {
  name: "base-strategy",

  async onTick(marketData) {
    console.log(`[strategy] tick: ${marketData.pair} @ ${marketData.price}`);
    return { signal: null };
  },

  async onSignal(signal, portfolio) {
    console.log(`[strategy] signal: ${signal.direction} ${signal.pair}`);
    return { action: null, reason: "no position logic implemented yet" };
  },

  checkRisk(order, limits) {
    if (order.sizeUsd > limits.maxPositionSizeUsd) {
      return { allowed: false, reason: "exceeds max position size" };
    }
    return { allowed: true };
  },
};
