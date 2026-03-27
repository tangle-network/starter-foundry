import { loadRegistry } from "./registry.mjs";

const plannedFamilies = [
  {
    id: "go-worker",
    language: "go",
    runtime: "go",
    surface: "worker",
    status: "planned",
    notes: "Lean queue or cron worker starter.",
  },
  {
    id: "playwright-worker",
    language: "typescript",
    runtime: "node",
    surface: "automation",
    status: "planned",
    notes: "Browser automation and scraping worker starter."
  },
  {
    id: "tauri-desktop",
    language: "rust",
    runtime: "tauri",
    surface: "desktop",
    status: "planned",
    notes: "Native desktop shell for teams that prefer Tauri over Electron."
  }
];

export async function buildCatalog() {
  const registry = await loadRegistry();
  const implemented = [...registry.families.values()].map((family) => ({
    id: family.id,
    status: "implemented",
    ...(family.taxonomy ?? {}),
    description: family.description,
  }));

  return {
    schemaVersion: 1,
    implemented,
    planned: plannedFamilies.filter((item) => item.status !== "implemented"),
    capabilityThemes: [
      "frontend",
      "mobile",
      "extension",
      "desktop",
      "cli",
      "backend",
      "worker",
      "edge",
      "data",
      "database",
      "auth",
      "payments",
      "queue",
      "sdk",
      "crypto",
    ],
    databaseTargets: ["convex", "sqlite", "postgres", "mongodb"],
    cryptoTargets: ["forge", "solana", "move"],
  };
}
