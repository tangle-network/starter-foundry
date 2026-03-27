import { loadRegistry } from "./registry.mjs";

const plannedFamilies = [];

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
    planned: plannedFamilies,
    capabilityThemes: [
      "frontend",
      "mobile",
      "extension",
      "desktop",
      "automation",
      "cli",
      "ai",
      "backend",
      "worker",
      "edge",
      "data",
      "protocol",
      "infra",
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
