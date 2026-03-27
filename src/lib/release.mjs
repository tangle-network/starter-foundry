import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { evaluateAgents } from "./agent-runners.mjs";
import { createAuditBundle } from "./audit.mjs";
import { benchmarkStarter } from "./benchmark.mjs";
import { createTempDir, sanitizePackageName, writeJson } from "./fs.mjs";
import { validateStarter } from "./validate.mjs";

function runTar(sourceDir, archivePath) {
  return new Promise((resolve) => {
    const child = spawn("tar", ["-czf", archivePath, "-C", sourceDir, "."], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

export async function createRelease({ spec, outDir = null, benchmarkRuns = 1, agents = null }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseDir =
    outDir ?? (await createTempDir(`starter-foundry-release-${sanitizePackageName(spec.projectName)}`));
  const releaseDir = path.join(baseDir, `${sanitizePackageName(spec.projectName)}-${timestamp}`);

  await fs.mkdir(releaseDir, { recursive: true });

  const audit = await createAuditBundle({ spec, outDir: releaseDir });
  const agentEvaluation = agents?.length
    ? await evaluateAgents({ spec, outDir: releaseDir, agents })
    : null;
  const validation = await validateStarter({ spec, outDir: releaseDir });
  const benchmark = await benchmarkStarter({ spec, runs: benchmarkRuns, outDir: releaseDir });

  const archivePath = path.join(baseDir, `${sanitizePackageName(spec.projectName)}-${timestamp}.tar.gz`);
  const archived = await runTar(releaseDir, archivePath);
  const releasePath = path.join(releaseDir, ".starter-foundry", "release.json");

  await writeJson(releasePath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spec,
    validation,
    benchmark,
    audit,
    agentEvaluation,
    archive: archived ? archivePath : null,
  });

  return {
    releaseDir,
    releasePath,
    archivePath: archived ? archivePath : null,
    validationOk: validation.ok,
    benchmarkPassRate: benchmark.summary.passRate,
    agentEvaluationPassRate: agentEvaluation?.summary.passRate ?? null,
  };
}
