import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadHooks() {
  try {
    const module = await import("./hooks.mjs");
    return module.default ?? module;
  } catch {
    return {};
  }
}

async function loadFeed() {
  try {
    const raw = await fs.readFile(path.join(__dirname, "market-feed.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { ticks: [] };
  }
}

const hooks = await loadHooks();
const feed = await loadFeed();

async function cycle() {
  const lastTick = feed.ticks.at(-1) ?? { symbol: "SIM", price: 0 };
  hooks.beforeCycle?.(lastTick);
  console.log(`[{{workerName}}] handling ${feed.ticks.length} ticks`);
  console.log(`[{{workerName}}] last tick ${lastTick.symbol}=${lastTick.price}`);
  hooks.afterCycle?.(lastTick);
  console.log("cycle complete");
}

if (process.env.RUN_ONCE === "1") {
  await cycle();
  process.exit(0);
}

setInterval(cycle, 2000);
await cycle();
