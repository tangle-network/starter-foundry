export function beforeRequest(snapshot) {
  return { startedAt: Date.now(), snapshot };
}

export function formatStats(stats) {
  return {
    ...stats,
    units: {
      gasPrice: "OKB gwei",
      tps: "tx/s",
      blockTime: "seconds",
    },
  };
}
