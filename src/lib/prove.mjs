import path from "node:path";
import { readJson, writeJson } from "./fs.mjs";
import { runPromptCorpus } from "./prompt-e2e.mjs";

function summarizeBucket(results) {
  return {
    scenarios: results.length,
    passRate: results.filter((result) => result.ok).length / results.length,
    routeAccuracy: results.filter((result) => result.routeOk).length / results.length,
    validationPassRate: results.filter((result) => result.validationOk).length / results.length,
    primaryArtifactHitRate: results.filter((result) => result.primaryArtifactHit).length / results.length,
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function collectFamilyCoverage(results) {
  const families = new Set();

  for (const result of results) {
    if (result.kind === "starter") {
      families.add(result.route.family);
      continue;
    }

    for (const family of Object.values(result.route.projectFamilies ?? {})) {
      families.add(family);
    }
  }

  return [...families].sort();
}

function collectComplexityBreakdown(results) {
  const groups = {};

  for (const result of results) {
    groups[result.complexity] = groups[result.complexity] ?? [];
    groups[result.complexity].push(result);
  }

  return Object.fromEntries(
    Object.entries(groups).map(([complexity, bucket]) => [complexity, summarizeBucket(bucket)]),
  );
}

function collectKindBreakdown(results) {
  const starters = results.filter((result) => result.kind === "starter");
  const workspaces = results.filter((result) => result.kind === "workspace");

  return {
    starter: summarizeBucket(starters),
    workspace: summarizeBucket(workspaces),
  };
}

function collectValidationCoverage(results) {
  const scenarioModes = countBy(results, (result) => result.validationEvidence.mode);
  const projectModes = {};

  for (const result of results) {
    for (const project of result.validationEvidence.projects ?? []) {
      projectModes[project.mode] = (projectModes[project.mode] ?? 0) + 1;
    }
  }

  return {
    scenarioModes,
    projectModes,
  };
}

export async function runProofSuite({ corpusPath, outDir }) {
  const corpus = await readJson(corpusPath);
  const promptE2E = await runPromptCorpus({ corpusPath, outDir });
  const { results, summary } = promptE2E.report;

  const proofReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    corpus: corpus.name,
    scenarioCount: promptE2E.report.scenarioCount,
    summary,
    coverage: {
      kinds: countBy(results, (result) => result.kind),
      complexities: collectComplexityBreakdown(results),
      byKind: collectKindBreakdown(results),
      families: collectFamilyCoverage(results),
      validation: collectValidationCoverage(results),
    },
    results,
  };

  const reportPath = path.join(outDir, "proof-report.json");
  await writeJson(reportPath, proofReport);

  return {
    outDir,
    reportPath,
    report: proofReport,
  };
}
