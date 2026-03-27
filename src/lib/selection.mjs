function keywordScore(prompt, keywords) {
  const lower = prompt.toLowerCase();
  return keywords.reduce((total, keyword) => total + (lower.includes(keyword) ? 1 : 0), 0);
}

export async function selectStarter({ prompt, partner = null }) {
  const candidates = [
    {
      family: "expo-react-native-ts",
      layers: ["framework:expo-react-native-ts"],
      score: keywordScore(prompt, ["expo", "react native", "mobile app", "ios app", "android app"]),
      reasons: ["mobile language detected"],
    },
    {
      family: "browser-extension-ts",
      layers: ["framework:browser-extension-ts"],
      score: keywordScore(prompt, ["browser extension", "chrome extension", "manifest v3", "extension popup", "firefox addon"]),
      reasons: ["browser extension language detected"],
    },
    {
      family: "electron-desktop-ts",
      layers: ["framework:electron-desktop-ts"],
      score: keywordScore(prompt, ["electron", "desktop app", "desktop assistant", "tray app"]),
      reasons: ["desktop language detected"],
    },
    {
      family: "cli-ts",
      layers: ["framework:cli-ts"],
      score: keywordScore(prompt, ["cli", "command line", "terminal tool", "shell tool", "developer tool"]),
      reasons: ["cli language detected"],
    },
    {
      family: "python-data-app",
      layers: ["framework:python-data-app"],
      score: keywordScore(prompt, ["streamlit", "gradio", "data app", "csv upload", "analytics app", "ml demo"]),
      reasons: ["python data app language detected"],
    },
    {
      family: "go-api",
      layers: ["framework:go-net-http"],
      score: keywordScore(prompt, ["golang", "go api", "go backend", "go service", "net/http"]),
      reasons: ["go backend language detected"],
    },
    {
      family: "solana-program",
      layers: ["framework:solana-native-rust"],
      score: keywordScore(prompt, ["solana", "anchor", "solana program", "program derived address", "pda"]),
      reasons: ["solana language detected"],
    },
    {
      family: "move-contracts",
      layers: ["framework:move-package"],
      score: keywordScore(prompt, ["move contract", "aptos", "sui move", "move module", "sui"]),
      reasons: ["move language detected"],
    },
    {
      family: "nextjs-ts",
      layers: ["framework:nextjs-app-router"],
      score: keywordScore(prompt, ["next", "next.js", "nextjs", "app router", "server action", "seo app"]),
      reasons: ["next.js language detected"],
    },
    {
      family: "react-vite-ts",
      layers: ["framework:react-vite-ts"],
      score: keywordScore(prompt, ["react", "vite", "spa", "component", "single page", "client app"]),
      reasons: ["react/vite language detected"],
    },
    {
      family: "fullstack-ts",
      layers: ["framework:fullstack-node-ts", "capability:logging"],
      score: keywordScore(prompt, [
        "fullstack",
        "full stack",
        "dashboard with api",
        "app with api",
        "admin app",
        "database-backed",
        "dashboard and api",
      ]),
      reasons: ["fullstack language detected"],
    },
    {
      family: "cloudflare-worker-ts",
      layers: ["framework:cloudflare-worker-ts"],
      score: keywordScore(prompt, ["cloudflare", "durable object", "edge api", "edge function", "hono edge", "workerd"]),
      reasons: ["edge/cloudflare language detected"],
    },
    {
      family: "python-api",
      layers: ["framework:python-http"],
      score: keywordScore(prompt, ["python", "fastapi", "flask", "django", "api in python"]),
      reasons: ["python api language detected"],
    },
    {
      family: "rust-service",
      layers: ["framework:rust-http"],
      score: keywordScore(prompt, ["rust", "rust service", "axum", "rust api", "rust backend", "cargo"]),
      reasons: ["rust service language detected"],
    },
    {
      family: "forge-contracts",
      layers: ["framework:forge-foundation"],
      score: keywordScore(prompt, ["solidity", "foundry", "forge", "erc20", "evm contract"]),
      reasons: ["forge/solidity language detected"],
    },
    {
      family: "frontend-static",
      layers: ["framework:web-static"],
      score: keywordScore(prompt, ["website", "landing", "frontend", "dashboard", "page", "ui", "preview"]),
      reasons: ["frontend-like language detected"],
    },
    {
      family: "api-service",
      layers: ["framework:node-http", "capability:logging"],
      score: keywordScore(prompt, ["api", "server", "endpoint", "backend", "service", "webhook"]),
      reasons: ["server/api language detected"],
    },
    {
      family: "worker-job",
      layers: ["framework:node-worker", "capability:market-sim"],
      score: keywordScore(prompt, ["bot", "worker", "trading", "queue", "cron", "stream"]),
      reasons: ["worker/bot language detected"],
    },
  ];

  candidates.sort((left, right) => right.score - left.score);
  const winner = candidates[0];
  const family = winner.score > 0 ? winner.family : "frontend-static";
  const layers = winner.score > 0 ? winner.layers : ["framework:web-static"];
  const confidence = winner.score > 2 ? "high" : winner.score > 0 ? "medium" : "low";
  const spec = {
    projectName: partner ? `${partner}-starter` : "generated-starter",
    family,
    layers,
    partner,
    slots: {},
    variables: {},
  };

  if (partner === "coinbase" && family === "frontend-static") {
    spec.layers = [...layers, "capability:chart-widget"];
    spec.variables.headline = "Ship a Coinbase-ready product surface";
  }

  if (partner === "coinbase" && (family === "react-vite-ts" || family === "nextjs-ts" || family === "fullstack-ts")) {
    spec.layers = [...new Set([...layers, "capability:chart-widget"])];
    spec.variables.headline = "Ship a Coinbase-ready product surface";
  }

  return {
    confidence,
    spec,
    fallbackUsed: winner.score === 0,
    reasons: winner.score > 0 ? winner.reasons : ["no confident match, using default frontend family"],
  };
}
