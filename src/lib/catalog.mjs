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
      "backend",
      "worker",
      "edge",
      "database",
      "sdk",
      "crypto",
    ],
    databaseTargets: ["convex", "sqlite", "postgres", "mongodb"],
    cryptoTargets: ["forge", "solana", "move"],
  };
}
