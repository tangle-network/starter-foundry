import { sanitizePackageName } from "./fs.mjs";
import { loadRegistry } from "./registry.mjs";
import { selectStarter } from "./selection.mjs";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeyword(text, keyword) {
  if (keyword.includes(" ") || keyword.includes(".") || keyword.includes("/") || keyword.includes("-")) {
    return text.includes(keyword);
  }

  return new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i").test(text);
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => matchesKeyword(text, keyword));
}

function countMatches(text, keywords) {
  return keywords.reduce((total, keyword) => total + (matchesKeyword(text, keyword) ? 1 : 0), 0);
}

function buildSlug(prompt, fallback) {
  const slug = sanitizePackageName(prompt).slice(0, 40);
  return slug || fallback;
}

function resolvePartnerForFamily(partner, family) {
  if (!partner) {
    return null;
  }

  const familySets = {
    coinbase: new Set([
      "frontend-static",
      "react-vite-ts",
      "nextjs-ts",
      "fullstack-ts",
      "expo-react-native-ts",
      "browser-extension-ts",
      "electron-desktop-ts",
      "tauri-desktop",
      "api-service",
      "cloudflare-worker-ts",
      "python-api",
      "rust-service",
      "go-api",
      "worker-job",
      "go-worker",
      "playwright-worker",
      "evm-infra-ts",
      "forge-contracts",
    ]),
    tangle: new Set([
      "frontend-static",
      "react-vite-ts",
      "nextjs-ts",
      "fullstack-ts",
      "api-service",
      "python-api",
      "rust-service",
      "go-api",
      "worker-job",
      "go-worker",
      "playwright-worker",
      "evm-infra-ts",
      "tangle-blueprint",
    ]),
    eigenlayer: new Set([
      "frontend-static",
      "react-vite-ts",
      "nextjs-ts",
      "fullstack-ts",
      "api-service",
      "python-api",
      "rust-service",
      "go-api",
      "worker-job",
      "go-worker",
      "playwright-worker",
      "evm-infra-ts",
      "eigenlayer-avs",
    ]),
    arbitrum: new Set([
      "frontend-static",
      "react-vite-ts",
      "nextjs-ts",
      "fullstack-ts",
      "api-service",
      "python-api",
      "rust-service",
      "go-api",
      "worker-job",
      "go-worker",
      "playwright-worker",
      "evm-infra-ts",
      "forge-contracts",
      "stylus-contracts",
    ]),
    xlayer: new Set([
      "frontend-static",
      "react-vite-ts",
      "nextjs-ts",
      "fullstack-ts",
      "api-service",
      "python-api",
      "rust-service",
      "go-api",
      "worker-job",
      "go-worker",
      "playwright-worker",
      "evm-infra-ts",
      "forge-contracts",
    ]),
    solana: new Set([
      "frontend-static",
      "react-vite-ts",
      "nextjs-ts",
      "fullstack-ts",
      "api-service",
      "python-api",
      "rust-service",
      "go-api",
      "worker-job",
      "go-worker",
      "playwright-worker",
      "solana-program",
    ]),
  };

  return familySets[partner]?.has(family) ? partner : null;
}

function detectDatabaseSlot(text) {
  if (text.includes("convex")) {
    return "database:convex";
  }
  if (text.includes("postgres")) {
    return "database:postgres";
  }
  if (text.includes("mongodb") || text.includes("mongo")) {
    return "database:mongodb";
  }
  if (text.includes("sqlite")) {
    return "database:sqlite";
  }
  return null;
}

function detectSdkSlot(text, partner) {
  if (text.includes("solana web3") || text.includes("@solana/web3") || text.includes("wallet adapter")) {
    return "sdk:solana-web3";
  }
  if (partner === "coinbase") {
    return "sdk:coinbase-cdp";
  }
  if (text.includes("coinbase cdp") || text.includes("coinbase sdk")) {
    return "sdk:coinbase-cdp";
  }
  if (
    partner === "xlayer" ||
    partner === "arbitrum" ||
    hasAny(text, ["walletconnect", "wallet connect", "okx wallet", "metamask", "viem", "ethers"])
  ) {
    return "sdk:evm-wallet";
  }
  return null;
}

function detectAuthSlot(text) {
  if (text.includes("clerk")) {
    return "auth:clerk";
  }
  if (text.includes("better auth") || text.includes("better-auth")) {
    return "auth:better-auth";
  }
  if (text.includes("supabase auth") || text.includes("supabase-auth")) {
    return "auth:supabase-auth";
  }
  return null;
}

function detectPaymentsSlot(text) {
  if (text.includes("coinbase commerce")) {
    return "payments:coinbase-commerce";
  }
  if (text.includes("stripe") || text.includes("subscription") || text.includes("billing") || text.includes("checkout")) {
    return "payments:stripe";
  }
  return null;
}

function detectQueueSlot(text) {
  if (text.includes("trigger.dev") || text.includes("trigger dev")) {
    return "queue:trigger-dev";
  }
  if (text.includes("bullmq") || text.includes("queue") || text.includes("background job")) {
    return "queue:bullmq";
  }
  return null;
}

function detectTangleLane(text) {
  return hasAny(text, [
    "tangle blueprint",
    "blueprint sdk",
    "cargo tangle",
    "oracle blueprint",
    "storage blueprint",
    "blueprint for tangle",
    "tangle network",
    "using tangle",
    "tangle's",
    "tangle native",
    "frost blueprint",
    "tangle oracle",
    "tangle custody",
  ]);
}

function detectTangleOraclePattern(text) {
  return hasAny(text, ["tangle", "tangle network", "tangle native"]) &&
    hasAny(text, ["oracle", "price feed", "attestation", "feeder", "operator rewards", "slashing", "data source"]);
}

function detectTangleCustodyPattern(text) {
  return hasAny(text, ["tangle", "tangle network", "tangle native", "frost"]) &&
    hasAny(text, ["custody", "mpc", "threshold signing", "key resharing", "policy engine", "signing ceremony"]);
}

function detectAvsLane(text) {
  return hasAny(text, ["eigenlayer", "avs", "oracle avs", "keeper avs", "sequencer avs", "coprocessor avs"]);
}

function detectStylusLane(text) {
  return hasAny(text, ["stylus", "arbitrum stylus"]);
}

function detectZkLane(text) {
  return hasAny(text, ["risc zero", "sp1", "circom", "snarkjs", "fhenix", "zk prover", "verifiable ml", "private voting", "dark pool", "mixer"]);
}

function detectMcpLane(text) {
  return hasAny(text, ["model context protocol", "mcp server", "mcp tools", "mcp tool server"]);
}

function detectDspyLane(text) {
  return hasAny(text, ["dspy", "rag system", "summarization system", "text classification system", "prompt engineering"]);
}

function detectX402Lane(text) {
  return hasAny(text, ["x402", "micropayments", "pay-per-request", "monetized api"]);
}

function detectEvmInfraLane(text) {
  return hasAny(text, [
    "viem",
    "ethers",
    "websocket",
    "rpc",
    "block monitor",
    "gas price",
    "transaction count",
    "multicall",
    "wallet balance",
    "wallet balances",
    "stats json endpoint",
    "layerzero",
    "oft",
    "sendtokens",
    "bundler",
    "permissionless.js",
    "monitor x layer",
    "monitor ethereum",
    "monitor arbitrum",
    "okb",
    "oklink",
    "okx",
  ]);
}

function detectEvmDeployPattern(text) {
  return hasAny(text, [
    "foundry.toml",
    "deploy script",
    "deploy task",
    "contract verification",
    "verify",
    "oklink explorer",
    ".env template",
    "private_key",
    "sample erc20",
  ]);
}

function detectEvmSupportApiPattern(text) {
  return hasAny(text, [
    "indexer",
    "subgraph",
    "events",
    "relayer",
    "paymaster",
    "bundler",
    "keeper",
    "oracle",
    "bridge",
    "bridges",
    "layerzero",
    "oft",
    "sendtokens",
    "hook",
    "analytics",
    "portfolio",
    "metrics",
    "multicall",
    "wallet balance",
    "transaction count",
    "gas price",
    "websocket",
    "/stats",
  ]);
}

function detectEvmLane(text) {
  return hasAny(text, [
    "solidity",
    "foundry",
    "forge",
    "erc20",
    "erc-20",
    "erc721",
    "erc-721",
    "erc-4337",
    "erc4337",
    "evm",
    "ethereum",
    "arbitrum",
    "base network",
    "base mainnet",
    "polygon",
    "x layer",
    "xlayer",
    "layerzero",
    "chainlink",
    "walletconnect",
    "flashbots",
    "flash loan",
    "aave",
    "uniswap",
    "sushiswap",
    "curve",
    "convex",
    "reservoir api",
    "marketplace core",
    "auction house",
    "lendingpool",
    "cover manager",
    "wallet factory",
    "bonding curve",
    "gateway",
  ]);
}

function inferPartner(text) {
  if (hasAny(text, ["coinbase", "base network", "coinbase commerce", "coinbase wallet", "coinbase cdp"])) {
    return "coinbase";
  }
  if (hasAny(text, ["tangle", "blueprint sdk", "cargo tangle"])) {
    return "tangle";
  }
  if (hasAny(text, ["eigenlayer", "avs"])) {
    return "eigenlayer";
  }
  if (hasAny(text, ["x layer", "xlayer", "okb", "oklink", "okx"])) {
    return "xlayer";
  }
  if (hasAny(text, ["arbitrum", "stylus"])) {
    return "arbitrum";
  }
  if (hasAny(text, ["solana", "anchor", "pda", "wallet adapter"])) {
    return "solana";
  }
  return null;
}

function needsSupportApiLane(text) {
  return hasAny(text, [
    "order management",
    "order history",
    "payment webhook",
    "quote generation",
    "claims",
    "transaction history",
    "history/audit",
    "portfolio",
    "analytics",
    "monitoring",
    "indexer",
    "websocket",
    "database",
    "metrics",
    "p&l",
    "api endpoints",
    "consumer integration",
    "historical data",
    "data source",
    "programmatic access",
  ]);
}

function detectSolanaProductApiPattern(text) {
  return hasAny(text, [
    "pyth",
    "switchboard",
    "jupiter",
    "openbook",
    "analytics",
    "leaderboard",
    "activity feed",
    "creator dashboard",
    "launch calendar",
    "pool discovery",
    "market browser",
    "market data",
    "oracle integration",
    "price feeds",
    "dashboard",
  ]);
}

function detectSolanaWorkerPattern(text) {
  return hasAny(text, [
    "keeper",
    "liquidation",
    "funding rate",
    "pyth price feeds",
    "switchboard",
    "oracle integration",
    "disputes",
    "auto-deleveraging",
  ]);
}

function buildEvmContractLayers(text) {
  const layers = ["framework:forge-foundation"];

  if (detectEvmDeployPattern(text)) {
    layers.push("capability:evm-deploy-foundry");
  }

  if (hasAny(text, ["layerzero", "oft", "bridge tokens", "sendtokens script", "omnichain fungible token"])) {
    layers.push("capability:evm-layerzero-oft");
  } else if (hasAny(text, ["erc-4337", "erc4337", "bundler", "permissionless.js", "gasless mint", "account abstraction"])) {
    layers.push("capability:evm-account-abstraction");
  }

  return layers;
}

function buildEvmContractVariables(text) {
  if (hasAny(text, ["layerzero", "oft", "omnichain fungible token"])) {
    return { contractName: "OmnichainToken" };
  }

  if (hasAny(text, ["erc721", "erc-721", "nft collection", "gasless mint"])) {
    return { contractName: "GaslessCollectible" };
  }

  if (hasAny(text, ["erc20", "erc-20", "sample erc20"])) {
    return { contractName: "XLayerToken" };
  }

  return { contractName: "Counter" };
}

function buildSolanaProgramLayers(text) {
  const layers = ["framework:solana-native-rust"];

  if (hasAny(text, ["perpetual", "futures", "funding rate", "liquidation", "insurance fund", "cross-collateral"])) {
    layers.push("capability:solana-perps");
  } else if (hasAny(text, ["concentrated liquidity", "tick-based liquidity", "swap router", "position nft"])) {
    layers.push("capability:solana-amm");
  } else if (hasAny(text, ["nft marketplace", "compressed nfts", "royalty enforcement", "bundle sales"])) {
    layers.push("capability:solana-nft");
  } else if (hasAny(text, ["launchpad", "fair launches", "dutch auction", "bonding curve", "claim portal"])) {
    layers.push("capability:solana-launchpad");
  } else if (hasAny(text, ["staking platform", "veToken", "rewards dashboard", "auto-compound", "validator delegation"])) {
    layers.push("capability:solana-staking");
  } else if (hasAny(text, ["prediction market", "binary (yes/no)", "switchboard oracle", "scalar", "categorical"])) {
    layers.push("capability:solana-prediction");
  }

  return layers;
}

function buildSolanaProgramVariables(text) {
  if (hasAny(text, ["perpetual", "futures"])) {
    return { instructionName: "InitializePerpMarket" };
  }

  if (hasAny(text, ["concentrated liquidity", "amm dex", "swap router"])) {
    return { instructionName: "InitializePool" };
  }

  if (hasAny(text, ["nft marketplace", "compressed nfts"])) {
    return { instructionName: "CreateListing" };
  }

  if (hasAny(text, ["launchpad", "fair launches", "bonding curve"])) {
    return { instructionName: "CreateLaunch" };
  }

  if (hasAny(text, ["staking platform", "veToken", "auto-compound"])) {
    return { instructionName: "InitializeStakePool" };
  }

  if (hasAny(text, ["prediction market", "scalar", "categorical"])) {
    return { instructionName: "CreateMarket" };
  }

  return { instructionName: "InitializeTreasury" };
}

function buildWebProject(prompt, partner, text) {
  const isNext = hasAny(text, ["next", "next.js", "nextjs", "app router", "seo"]);
  const family = isNext ? "nextjs-ts" : "react-vite-ts";
  const frameworkLayer = isNext ? "framework:nextjs-app-router" : "framework:react-vite-ts";
  const layers = [frameworkLayer];

  if (hasAny(text, ["dashboard", "metrics", "analytics", "control plane", "admin"])) {
    layers.push("capability:chart-widget");
  }

  const slots = {};
  const sdkSlot = detectSdkSlot(text, partner);
  const authSlot = detectAuthSlot(text);
  const paymentsSlot = detectPaymentsSlot(text);
  if (authSlot) {
    slots.auth = authSlot;
  }
  if (paymentsSlot) {
    slots.payments = paymentsSlot;
  }
  if (sdkSlot) {
    slots.sdk = sdkSlot;
  }

  return {
    id: "web",
    path: "apps/web",
    spec: {
      projectName: `${buildSlug(prompt, "workspace")}-web`,
      family,
      layers,
      partner: resolvePartnerForFamily(partner, family),
      slots,
      variables: {
        headline: "Ship the primary product surface first",
        subheadline: "This workspace starts with the user-visible surface before deepening the backend and contract lanes.",
      },
      primaryArtifactTargetMs: 2500,
    },
  };
}

function chooseWorkerFamily(text) {
  if (hasAny(text, ["playwright", "browser automation", "web scraping", "scraper", "crawler"])) {
    return {
      family: "playwright-worker",
      layers: ["framework:playwright-worker"],
      path: "apps/worker",
    };
  }

  if (hasAny(text, ["go worker", "golang worker", "go cron", "go queue", "go background job"])) {
    return {
      family: "go-worker",
      layers: ["framework:go-worker"],
      path: "apps/worker",
    };
  }

  const layers = ["framework:node-worker"];
  if (hasAny(text, ["trading", "market", "feed", "stream"])) {
    layers.push("capability:market-sim");
  }

  return {
    family: "worker-job",
    layers,
    path: "apps/worker",
  };
}

function chooseApiFamily(text) {
  if (detectX402Lane(text)) {
    return {
      family: "x402-service",
      layers: ["framework:x402-service"],
      path: "apps/api",
    };
  }

  if (detectMcpLane(text)) {
    return {
      family: "mcp-server-ts",
      layers: ["framework:mcp-server-ts"],
      path: "apps/mcp",
    };
  }

  if (detectDspyLane(text)) {
    return {
      family: "dspy-pipeline-py",
      layers: ["framework:dspy-pipeline-py"],
      path: "apps/ai",
    };
  }

  if (detectZkLane(text)) {
    return {
      family: "zk-prover-service",
      layers: ["framework:zk-prover-service"],
      path: "apps/prover",
    };
  }

  if (detectEvmInfraLane(text)) {
    return {
      family: "evm-infra-ts",
      layers: ["framework:evm-infra-ts"],
      path: "apps/api",
    };
  }

  if (hasAny(text, ["cloudflare", "durable object", "edge api", "edge function", "hono edge"])) {
    return {
      family: "cloudflare-worker-ts",
      layers: ["framework:cloudflare-worker-ts"],
      path: "apps/edge",
    };
  }

  if (hasAny(text, ["rust", "cargo", "axum", "rust api", "rust backend"])) {
    return {
      family: "rust-service",
      layers: ["framework:rust-http"],
      path: "apps/api",
    };
  }

  if (hasAny(text, ["python", "fastapi", "flask", "django", "python api"])) {
    return {
      family: "python-api",
      layers: ["framework:python-http"],
      path: "apps/api",
    };
  }

  if (hasAny(text, ["golang", "go api", "go backend", "go service", "net/http"])) {
    return {
      family: "go-api",
      layers: ["framework:go-net-http"],
      path: "apps/api",
    };
  }

  return {
    family: "api-service",
    layers: ["framework:node-http", "capability:logging"],
    path: "apps/api",
  };
}

function buildApiProject(prompt, partner, text) {
  const choice = chooseApiFamily(text);
  const layers = [...choice.layers];
  const slots = {};
  const databaseSlot = detectDatabaseSlot(text);
  const sdkSlot = detectSdkSlot(text, partner);
  const authSlot = detectAuthSlot(text);
  const paymentsSlot = detectPaymentsSlot(text);
  const queueSlot = detectQueueSlot(text);

  if (databaseSlot) {
    slots.database = databaseSlot;
  }
  if (authSlot) {
    slots.auth = authSlot;
  }
  if (paymentsSlot) {
    slots.payments = paymentsSlot;
  }
  if (queueSlot) {
    slots.queue = queueSlot;
  }

  if (sdkSlot) {
    slots.sdk = sdkSlot;
  }

  if ((choice.family === "api-service" || choice.family === "evm-infra-ts") && detectEvmSupportApiPattern(text)) {
    layers.push("capability:evm-protocol-api");
  }

  if (choice.family === "evm-infra-ts") {
    if (hasAny(text, ["block monitor", "new blocks", "gas price", "tps", "/stats", "websocket"])) {
      layers.push("capability:evm-chain-monitor");
    } else if (hasAny(text, ["wallet balance", "wallet address", "multicall", "summary table"])) {
      layers.push("capability:evm-wallet-dashboard");
    }
  }

  return {
    id: "api",
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, "workspace")}-api`,
      family: choice.family,
      layers,
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: {},
      primaryArtifactTargetMs: 2500,
    },
  };
}

function buildWorkerProject(prompt, partner, text) {
  const choice = chooseWorkerFamily(text);
  const layers = [...choice.layers];
  const slots = {};
  const queueSlot = detectQueueSlot(text);
  if (queueSlot) {
    slots.queue = queueSlot;
  }

  if (choice.family === "worker-job" && hasAny(text, ["solana", "anchor", "pyth", "switchboard", "keeper", "liquidation"])) {
    layers.push("capability:solana-keeper");
  }

  return {
    id: "worker",
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, "workspace")}-worker`,
      family: choice.family,
      layers,
      partner: resolvePartnerForFamily(partner, choice.family),
      slots,
      variables: {
        workerName: partner ? `${partner} worker lane` : "workspace worker lane",
      },
      primaryArtifactTargetMs: 2500,
    },
  };
}

function buildWorkspacePromptPlan({ prompt, partner, text }) {
  const specialSingleLane = hasAny(text, [
    "expo",
    "react native",
    "mobile app",
    "ios app",
    "android app",
    "browser extension",
    "chrome extension",
    "manifest v3",
    "electron",
    "desktop app",
    "desktop assistant",
    "command line",
    "terminal tool",
    "streamlit",
    "gradio",
    "data app",
    "tauri",
  ]);

  if (specialSingleLane) {
    return null;
  }

  const hasFrontend = hasAny(text, [
    "frontend",
    "ui",
    "website",
    "landing",
    "dashboard",
    "web app",
    "app",
    "preview",
    "next",
    "react",
  ]);
  const hasApi = hasAny(text, [
    "api",
    "backend",
    "server",
    "endpoint",
    "service",
    "webhook",
    "health check",
    "cloudflare",
    "durable object",
    "edge api",
    "edge function",
    "payment webhook",
    "server wallet",
    "rest api",
    "graphql api",
  ]);
  const hasWorker = hasAny(text, [
    "trading bot",
    "background job",
    "background worker",
    "worker for",
    "ai agent",
    "agent",
    "playwright worker",
    "automation worker",
    "go worker",
    "golang worker",
    "queue",
    "cron",
    "market stream",
    "bot",
  ]);
  const hasEvm = detectEvmLane(text);
  const hasSolana = hasAny(text, ["solana", "anchor", "pda"]);
  const hasMove = hasAny(text, ["move", "aptos", "sui"]);
  const hasTangle = detectTangleLane(text);
  const hasAvs = detectAvsLane(text);
  const hasStylus = detectStylusLane(text);
  const hasZk = detectZkLane(text);
  const hasMcp = detectMcpLane(text);
  const hasDspy = detectDspyLane(text);
  const hasX402 = detectX402Lane(text);
  const hasEvmInfra = detectEvmInfraLane(text);
  const runtimeCount = [hasEvm, hasSolana, hasMove].filter(Boolean).length;
  const apiChoice = hasApi ? chooseApiFamily(text) : null;
  const commerceSupportApi =
    !hasApi &&
    hasFrontend &&
    needsSupportApiLane(text) &&
    (partner === "coinbase" || detectPaymentsSlot(text) !== null || detectSdkSlot(text, partner) !== null);
  const implicitApi =
    !hasApi &&
    ((hasEvm || hasSolana || hasTangle || hasAvs || hasStylus || hasEvmInfra) &&
      (needsSupportApiLane(text) ||
        detectEvmSupportApiPattern(text) ||
        (hasSolana && detectSolanaProductApiPattern(text))) ||
      commerceSupportApi);
  const implicitWorker = !hasWorker && ((hasSolana && detectSolanaWorkerPattern(text)) || (hasEvm && hasAny(text, ["keeper", "bundler"])));
  const workspaceSignals = hasAny(text, [
    "workspace",
    "monorepo",
    "separate backend",
    "separate api",
    "background worker",
    "contract lane",
    "contract lanes",
  ]);
  const fitsFullstackStarter =
    !workspaceSignals &&
    !hasWorker &&
    !hasEvm &&
    !hasSolana &&
    !hasMove &&
    !hasTangle &&
    !hasAvs &&
    !hasStylus &&
    !hasZk &&
    !hasMcp &&
    !hasDspy &&
    !hasX402 &&
    !hasEvmInfra &&
    hasFrontend &&
    hasApi &&
    hasAny(text, [
      "fullstack",
      "full stack",
      "dashboard with api",
      "app with api",
      "admin app",
      "database-backed",
      "dashboard and api",
      "admin flows",
    ]);
  const laneCount = [
    hasFrontend,
    hasApi,
    hasWorker,
    hasEvm,
    hasSolana,
    hasMove,
    hasTangle,
    hasAvs,
    hasStylus,
    hasZk,
    hasMcp,
    hasDspy,
    hasX402,
    hasEvmInfra,
    implicitApi,
  ].filter(Boolean).length;
  const needsWorkspace =
    runtimeCount > 1 ||
    (hasFrontend && runtimeCount > 0) ||
    (hasFrontend && hasApi) ||
    (hasWorker && laneCount > 1) ||
    (hasFrontend && (hasTangle || hasAvs || hasStylus || hasZk || hasMcp || hasDspy || hasX402)) ||
    (hasFrontend && hasApi && apiChoice && apiChoice.family !== "api-service") ||
    (hasFrontend && implicitApi) ||
    (implicitApi && (hasEvm || hasSolana || hasMove || hasTangle || hasAvs || hasStylus)) ||
    implicitWorker ||
    (workspaceSignals && laneCount > 1);

  if (!needsWorkspace || fitsFullstackStarter) {
    return null;
  }

  const projects = [];
  if (hasFrontend) {
    projects.push(buildWebProject(prompt, partner, text));
  }

  if (hasApi || implicitApi) {
    projects.push(buildApiProject(prompt, partner, text));
  }

  if (hasWorker || implicitWorker) {
    projects.push(buildWorkerProject(prompt, partner, text));
  }

  if (hasMcp && !hasApi) {
    projects.push({
      id: "mcp",
      path: "apps/mcp",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-mcp`,
        family: "mcp-server-ts",
        layers: ["framework:mcp-server-ts"],
        partner: null,
        slots: {},
        variables: {},
      },
    });
  }

  if (hasDspy && !hasApi) {
    projects.push({
      id: "ai",
      path: "apps/ai",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-ai`,
        family: "dspy-pipeline-py",
        layers: ["framework:dspy-pipeline-py"],
        partner: null,
        slots: {},
        variables: {},
      },
    });
  }

  if (hasX402 && !hasApi) {
    projects.push({
      id: "api",
      path: "apps/api",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-api`,
        family: "x402-service",
        layers: ["framework:x402-service"],
        partner: resolvePartnerForFamily(partner, "x402-service"),
        slots: {},
        variables: {},
        primaryArtifactTargetMs: 2500,
      },
    });
  }

  if (hasTangle) {
    const tangleLayers = ["framework:tangle-blueprint"];
    if (detectTangleCustodyPattern(text)) {
      tangleLayers.push("capability:tangle-custody");
    } else if (detectTangleOraclePattern(text)) {
      tangleLayers.push("capability:tangle-oracle");
    }
    const blueprintProfile = text.includes("custody")
      ? { blueprintName: "custody-blueprint", jobName: "ApproveTransaction" }
      : text.includes("oracle")
        ? { blueprintName: "oracle-blueprint", jobName: "UpdatePriceFeed" }
        : text.includes("zk")
          ? { blueprintName: "zk-prover-blueprint", jobName: "GenerateProof" }
          : { blueprintName: "storage-blueprint", jobName: "StoreObject" };
    projects.push({
      id: "tangle",
      path: "protocols/tangle",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-tangle`,
        family: "tangle-blueprint",
        layers: tangleLayers,
        partner: resolvePartnerForFamily(partner, "tangle-blueprint"),
        slots: {},
        variables: blueprintProfile,
      },
    });
  }

  if (hasAvs) {
    const avsName = text.includes("oracle")
      ? "oracle-avs"
      : text.includes("keeper")
        ? "keeper-avs"
        : text.includes("sequencer")
          ? "sequencer-avs"
          : text.includes("bridge")
            ? "bridge-avs"
            : "data-availability-avs";
    projects.push({
      id: "avs",
      path: "protocols/avs",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-avs`,
        family: "eigenlayer-avs",
        layers: ["framework:eigenlayer-avs"],
        partner: resolvePartnerForFamily(partner, "eigenlayer-avs"),
        slots: {},
        variables: {
          avsName,
        },
      },
    });
  }

  if (hasStylus) {
    projects.push({
      id: "stylus",
      path: "contracts/stylus",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-stylus`,
        family: "stylus-contracts",
        layers: ["framework:stylus-contracts"],
        partner: resolvePartnerForFamily(partner, "stylus-contracts"),
        slots: {},
        variables: {
          contractName: "StylusPool",
        },
      },
    });
  }

  if (hasZk && !hasApi) {
    projects.push({
      id: "zk",
      path: "apps/prover",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-zk`,
        family: "zk-prover-service",
        layers: ["framework:zk-prover-service"],
        partner: null,
        slots: {},
        variables: {
          proofSystem: text.includes("circom") ? "circom" : text.includes("fhenix") ? "fhenix" : text.includes("risc zero") ? "risc-zero" : "sp1",
        },
      },
    });
  }

  if (hasEvm) {
    projects.push({
      id: "evm",
      path: "contracts/evm",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-evm`,
        family: "forge-contracts",
        layers: buildEvmContractLayers(text),
        partner: resolvePartnerForFamily(partner, "forge-contracts"),
        slots: {},
        variables: buildEvmContractVariables(text),
      },
    });
  }

  if (hasSolana) {
    projects.push({
      id: "solana",
      path: "contracts/solana",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-solana`,
        family: "solana-program",
        layers: buildSolanaProgramLayers(text),
        partner: resolvePartnerForFamily(partner, "solana-program"),
        slots: {},
        variables: buildSolanaProgramVariables(text),
      },
    });
  }

  if (hasMove) {
    projects.push({
      id: "move",
      path: "contracts/move",
      spec: {
        projectName: "move_treasury",
        family: "move-contracts",
        layers: ["framework:move-package"],
        partner: null,
        slots: {},
        variables: {
          moduleName: "TreasuryVault",
        },
      },
    });
  }

  const primaryProjectId = projects.find((project) => project.id === "web")?.id ?? projects[0]?.id ?? "web";

  return {
    kind: "workspace",
    confidence: runtimeCount > 1 ? "high" : "medium",
    reasons: ["multi-lane workspace prompt detected"],
    spec: {
      workspaceName: `${buildSlug(prompt, "workspace")}-workspace`,
      userPrompt: prompt,
      launchPlan: {
        primaryProjectId,
        primaryArtifact: {
          kind: primaryProjectId === "web" ? "preview" : "service",
          path: primaryProjectId === "web" ? "/" : "/health",
          targetMs: 2500,
        },
        initialAgentMission:
          "Build the user's prompt on top of this prepared workspace. Start with the primary product surface, then extend the surrounding lanes.",
      },
      projects,
    },
  };
}

export async function planPrompt({ prompt, partner = null }) {
  const text = prompt.toLowerCase();
  const effectivePartner = partner ?? inferPartner(text);
  const workspacePlan = buildWorkspacePromptPlan({ prompt, partner: effectivePartner, text });

  if (workspacePlan) {
    return workspacePlan;
  }

  const starterSelection = await selectStarter({ prompt, partner: effectivePartner });
  const registry = await loadRegistry();
  const family = registry.families.get(starterSelection.spec.family);
  const spec = {
    ...starterSelection.spec,
    projectName: buildSlug(prompt, starterSelection.spec.projectName),
    primaryArtifactTargetMs: 2500,
  };

  const databaseSlot = detectDatabaseSlot(text);
  const sdkSlot = detectSdkSlot(text, effectivePartner);
  const authSlot = detectAuthSlot(text);
  const paymentsSlot = detectPaymentsSlot(text);
  const queueSlot = detectQueueSlot(text);
  spec.slots = { ...(spec.slots ?? {}) };

  if (databaseSlot && family?.slots?.database) {
    spec.slots.database = databaseSlot;
  }

  if (sdkSlot && family?.slots?.sdk) {
    spec.slots.sdk = sdkSlot;
  }

  if (authSlot && family?.slots?.auth) {
    spec.slots.auth = authSlot;
  }

  if (paymentsSlot && family?.slots?.payments) {
    spec.slots.payments = paymentsSlot;
  }

  if (queueSlot && family?.slots?.queue) {
    spec.slots.queue = queueSlot;
  }

  if (detectTangleLane(text)) {
    spec.family = "tangle-blueprint";
    spec.layers = ["framework:tangle-blueprint"];
    if (detectTangleCustodyPattern(text)) {
      spec.layers.push("capability:tangle-custody");
    } else if (detectTangleOraclePattern(text)) {
      spec.layers.push("capability:tangle-oracle");
    }
  }

  if (detectAvsLane(text)) {
    spec.family = "eigenlayer-avs";
    spec.layers = ["framework:eigenlayer-avs"];
  }

  if (detectStylusLane(text)) {
    spec.family = "stylus-contracts";
    spec.layers = ["framework:stylus-contracts"];
  }

  if (detectZkLane(text)) {
    spec.family = "zk-prover-service";
    spec.layers = ["framework:zk-prover-service"];
    spec.variables = {
      ...(spec.variables ?? {}),
      proofSystem: text.includes("circom") ? "circom" : text.includes("fhenix") ? "fhenix" : text.includes("risc zero") ? "risc-zero" : "sp1",
    };
  }

  if (detectMcpLane(text)) {
    spec.family = "mcp-server-ts";
    spec.layers = ["framework:mcp-server-ts"];
  }

  if (detectDspyLane(text)) {
    spec.family = "dspy-pipeline-py";
    spec.layers = ["framework:dspy-pipeline-py"];
  }

  if (detectX402Lane(text)) {
    spec.family = "x402-service";
    spec.layers = ["framework:x402-service"];
  }

  if (detectEvmDeployPattern(text) && hasAny(text, ["foundry", "forge", "hardhat", "solidity", "erc20", "erc721", "layerzero"])) {
    spec.family = "forge-contracts";
    spec.layers = buildEvmContractLayers(text);
    spec.variables = {
      ...(spec.variables ?? {}),
      ...buildEvmContractVariables(text),
    };
  }

  if (spec.family === "forge-contracts") {
    spec.layers = buildEvmContractLayers(text);
    spec.variables = {
      ...(spec.variables ?? {}),
      ...buildEvmContractVariables(text),
    };
  }

  if (spec.family === "solana-program") {
    spec.layers = buildSolanaProgramLayers(text);
    spec.variables = {
      ...(spec.variables ?? {}),
      ...buildSolanaProgramVariables(text),
    };
  }

  if (spec.family === "evm-infra-ts") {
    if (hasAny(text, ["block monitor", "new blocks", "gas price", "tps", "/stats", "websocket"])) {
      spec.layers = [...new Set([...(spec.layers ?? []), "capability:evm-chain-monitor"])];
    } else if (hasAny(text, ["wallet balance", "wallet address", "multicall", "summary table"])) {
      spec.layers = [...new Set([...(spec.layers ?? []), "capability:evm-wallet-dashboard"])];
    }
  }

  if (hasAny(text, ["rust", "cargo"]) && spec.family === "api-service") {
    spec.family = "rust-service";
    spec.layers = ["framework:rust-http"];
  }

  return {
    kind: "starter",
    confidence: starterSelection.confidence,
    reasons: starterSelection.reasons,
    spec,
  };
}
