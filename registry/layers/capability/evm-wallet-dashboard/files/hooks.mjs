export function beforeRequest(input) {
  return {
    address: input.address ?? "0x0000000000000000000000000000000000000000",
    assets: ["OKB", "USDC", "USDT"],
  };
}

export function summarizeBalances(balances) {
  return balances.map((item) => `${item.symbol}: ${item.amount}`).join("\n");
}
