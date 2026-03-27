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
      partner,
      slots,
      variables: {
        headline: "Ship the primary product surface first",
        subheadline: "This workspace starts with the user-visible surface before deepening the backend and contract lanes.",
      },
      primaryArtifactTargetMs: 2500,
    },
  };
}

function chooseApiFamily(text) {
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

  return {
    id: "api",
    path: choice.path,
    spec: {
      projectName: `${buildSlug(prompt, "workspace")}-api`,
      family: choice.family,
      layers: choice.layers,
      partner,
      slots,
      variables: {},
      primaryArtifactTargetMs: 2500,
    },
  };
}

function buildWorkerProject(prompt, partner, text) {
  const layers = ["framework:node-worker"];
  const slots = {};
  if (hasAny(text, ["trading", "market", "feed", "stream"])) {
    layers.push("capability:market-sim");
  }
  const queueSlot = detectQueueSlot(text);
  if (queueSlot) {
    slots.queue = queueSlot;
  }

  return {
    id: "worker",
    path: "apps/worker",
    spec: {
      projectName: `${buildSlug(prompt, "workspace")}-worker`,
      family: "worker-job",
      layers,
      partner: null,
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
  ]);
  const hasWorker = hasAny(text, [
    "trading bot",
    "background job",
    "background worker",
    "worker for",
    "queue",
    "cron",
    "market stream",
    "bot",
  ]);
  const hasEvm = hasAny(text, ["solidity", "foundry", "forge", "erc20", "evm"]);
  const hasSolana = hasAny(text, ["solana", "anchor", "pda"]);
  const hasMove = hasAny(text, ["move", "aptos", "sui"]);
  const runtimeCount = [hasEvm, hasSolana, hasMove].filter(Boolean).length;
  const apiChoice = hasApi ? chooseApiFamily(text) : null;
  const workspaceSignals = hasAny(text, [
    "workspace",
    "monorepo",
    "separate backend",
    "separate api",
    "background worker",
    "contract lane",
    "contract lanes",
  ]);
  const laneCount = [hasFrontend, hasApi, hasWorker, hasEvm, hasSolana, hasMove].filter(Boolean).length;
  const needsWorkspace =
    runtimeCount > 1 ||
    (hasFrontend && runtimeCount > 0) ||
    (hasWorker && laneCount > 1) ||
    (hasFrontend && hasApi && apiChoice && apiChoice.family !== "api-service") ||
    (workspaceSignals && laneCount > 1);

  if (!needsWorkspace) {
    return null;
  }

  const projects = [];
  if (hasFrontend) {
    projects.push(buildWebProject(prompt, partner, text));
  }

  if (hasApi) {
    projects.push(buildApiProject(prompt, partner, text));
  }

  if (hasWorker) {
    projects.push(buildWorkerProject(prompt, partner, text));
  }

  if (hasEvm) {
    projects.push({
      id: "evm",
      path: "contracts/evm",
      spec: {
        projectName: `${buildSlug(prompt, "workspace")}-evm`,
        family: "forge-contracts",
        layers: ["framework:forge-foundation"],
        partner: null,
        slots: {},
        variables: {
          contractName: "TreasuryRouter",
        },
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
        layers: ["framework:solana-native-rust"],
        partner: null,
        slots: {},
        variables: {
          instructionName: "InitializeTreasury",
        },
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
  const workspacePlan = buildWorkspacePromptPlan({ prompt, partner, text });

  if (workspacePlan) {
    return workspacePlan;
  }

  const starterSelection = await selectStarter({ prompt, partner });
  const registry = await loadRegistry();
  const family = registry.families.get(starterSelection.spec.family);
  const spec = {
    ...starterSelection.spec,
    projectName: buildSlug(prompt, starterSelection.spec.projectName),
    primaryArtifactTargetMs: 2500,
  };

  const databaseSlot = detectDatabaseSlot(text);
  const sdkSlot = detectSdkSlot(text, partner);
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

  if (hasAny(text, ["rust", "cargo"])) {
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
