function keywordScore(prompt, keywords) {
  const lower = prompt.toLowerCase();
  return keywords.reduce((total, keyword) => total + (lower.includes(keyword) ? 1 : 0), 0);
}

export async function selectStarter({ prompt, partner = null }) {
  const lower = prompt.toLowerCase();
  const candidates = [
    {
      family: "tangle-blueprint",
      layers: ["framework:tangle-blueprint"],
      score: keywordScore(prompt, [
        "tangle blueprint",
        "blueprint sdk",
        "cargo tangle",
        "oracle blueprint",
        "storage blueprint",
        "tangle network",
        "tangle native",
        "tangle oracle",
        "tangle custody",
        "frost blueprint",
      ]),
      reasons: ["tangle blueprint language detected"],
    },
    {
      family: "eigenlayer-avs",
      layers: ["framework:eigenlayer-avs"],
      score: keywordScore(prompt, ["eigenlayer", "avs", "oracle avs", "keeper avs", "sequencer avs", "coprocessor avs"]),
      reasons: ["eigenlayer avs language detected"],
    },
    {
      family: "stylus-contracts",
      layers: ["framework:stylus-contracts"],
      score: keywordScore(prompt, ["stylus", "arbitrum stylus"]),
      reasons: ["stylus language detected"],
    },
    {
      family: "zk-prover-service",
      layers: ["framework:zk-prover-service"],
      score: keywordScore(prompt, ["risc zero", "sp1", "circom", "snarkjs", "fhenix", "zk prover", "verifiable ml", "private voting", "dark pool", "mixer"]),
      reasons: ["zk infrastructure language detected"],
    },
    {
      family: "mcp-server-ts",
      layers: ["framework:mcp-server-ts"],
      score: keywordScore(prompt, ["model context protocol", "mcp server", "mcp tools", "mcp tool server"]),
      reasons: ["mcp server language detected"],
    },
    {
      family: "dspy-pipeline-py",
      layers: ["framework:dspy-pipeline-py"],
      score: keywordScore(prompt, ["dspy", "rag system", "summarization system", "text classification system", "prompt engineering"]),
      reasons: ["dspy pipeline language detected"],
    },
    {
      family: "x402-service",
      layers: ["framework:x402-service"],
      score: keywordScore(prompt, ["x402", "micropayments", "pay-per-request", "monetized api"]),
      reasons: ["x402 language detected"],
    },
    {
      family: "evm-infra-ts",
      layers: ["framework:evm-infra-ts"],
      score: keywordScore(prompt, [
        "viem",
        "ethers",
        "websocket",
        "rpc",
        "block monitor",
        "gas price",
        "transaction count",
        "multicall",
        "wallet balance",
        "okb",
        "oklink",
        "okx",
        "x layer",
        "xlayer",
        "/stats",
      ]),
      reasons: ["evm infrastructure language detected"],
    },
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
      family: "tauri-desktop",
      layers: ["framework:tauri-desktop"],
      score: keywordScore(prompt, ["tauri", "native desktop", "rust desktop", "tauri app"]),
      reasons: ["tauri desktop language detected"],
    },
    {
      family: "electron-desktop-ts",
      layers: ["framework:electron-desktop-ts"],
      score: keywordScore(prompt, ["electron", "desktop app", "desktop assistant", "tray app"]),
      reasons: ["desktop language detected"],
    },
    {
      family: "go-worker",
      layers: ["framework:go-worker"],
      score:
        keywordScore(prompt, ["go worker", "golang worker", "go cron", "go queue", "go background job"]) +
        (prompt.toLowerCase().includes("go worker") || prompt.toLowerCase().includes("golang worker") ? 2 : 0),
      reasons: ["go worker language detected"],
    },
    {
      family: "cli-ts",
      layers: ["framework:cli-ts"],
      score: keywordScore(prompt, ["cli", "command line", "terminal tool", "shell tool", "developer tool"]),
      reasons: ["cli language detected"],
    },
    {
      family: "playwright-worker",
      layers: ["framework:playwright-worker"],
      score: keywordScore(prompt, ["playwright", "browser automation", "web scraping", "scraper", "crawler"]),
      reasons: ["playwright automation language detected"],
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
      score: keywordScore(prompt, [
        "solana",
        "anchor",
        "solana program",
        "program derived address",
        "pda",
        "pyth",
        "switchboard",
        "jupiter",
        "openbook",
      ]),
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
      score: keywordScore(prompt, [
        "solidity",
        "foundry",
        "forge",
        "hardhat",
        "foundry.toml",
        "deploy script",
        "deploy task",
        "contract verification",
        "verify",
        "private_key",
        ".env template",
        "erc20",
        "erc-20",
        "erc721",
        "erc-721",
        "erc-4337",
        "erc4337",
        "evm contract",
        "ethereum",
        "arbitrum",
        "base network",
        "x layer",
        "xlayer",
        "layerzero",
        "chainlink",
        "wallet factory",
        "auction house",
        "lendingpool",
        "cover manager",
        "gateway",
        "viem",
        "okb",
        "oklink",
      ]),
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

  for (const candidate of candidates) {
    if (
      candidate.family === "forge-contracts" &&
      (lower.includes("foundry") ||
        lower.includes("forge") ||
        lower.includes("hardhat") ||
        lower.includes("foundry.toml") ||
        lower.includes("contract verification"))
    ) {
      candidate.score += 3;
    }

    if (
      candidate.family === "evm-infra-ts" &&
      (lower.includes("foundry") ||
        lower.includes("forge") ||
        lower.includes("hardhat") ||
        lower.includes("solidity") ||
        lower.includes("erc20") ||
        lower.includes("erc721"))
    ) {
      candidate.score -= 2;
    }

    if (
      candidate.family === "evm-infra-ts" &&
      (lower.includes("block monitor") ||
        lower.includes("websocket") ||
        lower.includes("multicall") ||
        lower.includes("wallet balance") ||
        lower.includes("/stats"))
    ) {
      candidate.score += 2;
    }
  }

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

  if (
    partner === "coinbase" &&
    (family === "react-vite-ts" || family === "nextjs-ts" || family === "fullstack-ts" || family === "x402-service")
  ) {
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
