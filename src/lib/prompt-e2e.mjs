import path from "node:path";
import { benchmarkStarter } from "./benchmark.mjs";
import { createTempDir, readJson, removeDir, writeJson } from "./fs.mjs";
import { planPrompt } from "./prompt-planner.mjs";
import { benchmarkWorkspace } from "./workspace.mjs";

function classifyProjectValidation(validationChecks) {
  let hasLiveRuntime = false;
  let hasToolchain = false;
  const tools = new Set();

  for (const check of validationChecks) {
    if (check.type === "http-start") {
      hasLiveRuntime = true;
      if (check.command?.[0]) {
        tools.add(check.command[0]);
      }
      continue;
    }

    if (check.type === "python-compile") {
      hasToolchain = true;
      tools.add("python3");
      continue;
    }

    if (check.type !== "command-success") {
      continue;
    }

    const [bin = "unknown", ...args] = check.command ?? [];
    const commandText = [bin, ...args].join(" ");
    if (bin === "node" && commandText.includes("validate-")) {
      continue;
    }

    if (["cargo", "forge", "go", "python3", "solana", "anchor", "aptos", "sui", "wrangler"].includes(bin)) {
      hasToolchain = true;
      tools.add(bin);
      continue;
    }

    hasLiveRuntime = true;
    tools.add(bin);
  }

  return {
    mode: hasLiveRuntime ? "live-runtime" : hasToolchain ? "toolchain" : "structural",
    tools: [...tools].sort(),
    checks: validationChecks.length,
  };
}

async function loadStarterValidationEvidence(runDir) {
  const composeReport = await readJson(path.join(runDir, ".starter-foundry", "compose-report.json"));
  const project = classifyProjectValidation(composeReport.validationChecks);
  return {
    mode: project.mode,
    tools: project.tools,
    projects: [
      {
        id: "root",
        family: composeReport.components.family,
        ...project,
      },
    ],
  };
}

async function loadWorkspaceValidationEvidence(runDir, plan) {
  const projects = [];

  for (const project of plan.spec.projects) {
    const composeReport = await readJson(
      path.join(runDir, project.path, ".starter-foundry", "compose-report.json"),
    );
    projects.push({
      id: project.id,
      family: composeReport.components.family,
      ...classifyProjectValidation(composeReport.validationChecks),
    });
  }

  const modes = new Set(projects.map((project) => project.mode));
  return {
    mode: modes.size === 1 ? projects[0]?.mode ?? "structural" : "mixed",
    tools: [...new Set(projects.flatMap((project) => project.tools))].sort(),
    projects,
  };
}

function matchesExpectation(result, expected) {
  if (!expected) {
    return true;
  }

  if (expected.kind !== result.kind) {
    return false;
  }

  if (expected.kind === "starter") {
    const sameFamily = expected.family === result.route.family;
    const sameSlots = Object.entries(expected.slots ?? {}).every(
      ([slotName, layerId]) => result.route.slots?.[slotName] === layerId,
    );
    return sameFamily && sameSlots;
  }

  const samePrimary = expected.primaryProjectId === result.route.primaryProjectId;
  const sameProjects = expected.projectIds.every((projectId) => result.route.projectIds.includes(projectId));
  const sameFamilies = Object.entries(expected.projectFamilies ?? {}).every(
    ([projectId, family]) => result.route.projectFamilies?.[projectId] === family,
  );
  return samePrimary && sameProjects && sameFamilies;
}

export async function runPromptCorpus({ corpusPath, outDir = null }) {
  const corpus = await readJson(path.resolve(corpusPath));
  const results = [];
  const baseDir = outDir ?? (await createTempDir("starter-foundry-prompt-e2e"));

  try {
    for (const scenario of corpus.scenarios) {
      const runDir = path.join(baseDir, scenario.id);
      const plan = await planPrompt({
        prompt: scenario.prompt,
        partner: scenario.partner ?? null,
      });

      let benchmark;
      let route;

      if (plan.kind === "starter") {
        benchmark = await benchmarkStarter({
          spec: plan.spec,
          runs: 1,
          outDir: runDir,
        });
        route = {
          family: plan.spec.family,
          slots: plan.spec.slots ?? {},
        };
      } else {
        benchmark = await benchmarkWorkspace({
          spec: plan.spec,
          runs: 1,
          outDir: runDir,
        });
        route = {
          primaryProjectId: plan.spec.launchPlan.primaryProjectId,
          projectIds: plan.spec.projects.map((project) => project.id),
          projectFamilies: Object.fromEntries(plan.spec.projects.map((project) => [project.id, project.spec.family])),
        };
      }

      const benchmarkRunDir = benchmark.results[0].outDir;
      const validationEvidence =
        plan.kind === "starter"
          ? await loadStarterValidationEvidence(benchmarkRunDir)
          : await loadWorkspaceValidationEvidence(benchmarkRunDir, plan);

      const routeOk = matchesExpectation(
        {
          kind: plan.kind,
          route,
        },
        scenario.expected,
      );

      const validationOk =
        plan.kind === "starter" ? benchmark.summary.passRate === 1 : benchmark.summary.passRate === 1;
      const primaryArtifactHit =
        plan.kind === "starter"
          ? benchmark.summary.primaryArtifactHitRate === 1
          : benchmark.summary.primaryArtifactHitRate === 1;

      results.push({
        id: scenario.id,
        complexity: scenario.complexity,
        partner: scenario.partner ?? null,
        prompt: scenario.prompt,
        kind: plan.kind,
        confidence: plan.confidence,
        route,
        routeOk,
        validationOk,
        primaryArtifactHit,
        validationEvidence,
        benchmark,
        ok: routeOk && validationOk && primaryArtifactHit,
      });
    }

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      corpus: corpus.name,
      scenarioCount: results.length,
      results,
      summary: {
        passRate: results.filter((result) => result.ok).length / results.length,
        routeAccuracy: results.filter((result) => result.routeOk).length / results.length,
        validationPassRate: results.filter((result) => result.validationOk).length / results.length,
        primaryArtifactHitRate: results.filter((result) => result.primaryArtifactHit).length / results.length,
      },
    };

    await writeJson(path.join(baseDir, "prompt-e2e-report.json"), report);

    return {
      outDir: baseDir,
      reportPath: path.join(baseDir, "prompt-e2e-report.json"),
      report,
    };
  } finally {
    if (!outDir) {
      await removeDir(baseDir);
    }
  }
}
