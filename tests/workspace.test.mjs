import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createTempDir, readJson, removeDir } from "../src/lib/fs.mjs";
import { benchmarkWorkspace, composeWorkspace, createWorkspaceContextPack } from "../src/lib/workspace.mjs";

async function loadWorkspaceSpec() {
  return readJson(path.resolve("specs/multichain-workspace.json"));
}

test("workspace compose writes root instructions and launch plan", async () => {
  const spec = await loadWorkspaceSpec();
  const outDir = await createTempDir("starter-foundry-workspace-compose");

  try {
    const result = await composeWorkspace({ spec, outDir });
    const projectDoc = await fs.readFile(path.join(outDir, "PROJECT.md"), "utf8");
    const agentsDoc = await fs.readFile(path.join(outDir, "AGENTS.md"), "utf8");
    const report = await readJson(result.workspaceReportPath);

    assert.equal(result.projectCount, 4);
    assert.equal(report.launchPlan.primaryProjectId, "web");
    assert.match(projectDoc, /multichain product studio/i);
    assert.match(agentsDoc, /Primary project is `web`/);
    assert.ok(report.projects.some((project) => project.path === "apps/web"));
    assert.ok(report.projects.some((project) => project.path === "contracts/solana"));
  } finally {
    await removeDir(outDir);
  }
});

test("workspace context pack captures project boundaries and launch plan", async () => {
  const spec = await loadWorkspaceSpec();
  const outDir = await createTempDir("starter-foundry-workspace-context");

  try {
    await composeWorkspace({ spec, outDir });
    const report = await readJson(path.join(outDir, ".starter-foundry", "workspace-report.json"));
    const result = await createWorkspaceContextPack({ spec, outDir, workspaceReport: report });

    assert.equal(result.contextPack.projects.length, 4);
    assert.equal(result.contextPack.launchPlan.primaryProjectId, "web");
    assert.ok(result.contextPack.projects.some((project) => project.path === "contracts/evm"));
    assert.ok(result.contextPack.projects.some((project) => project.entrypoints.includes("app/page.tsx")));
  } finally {
    await removeDir(outDir);
  }
});

test("workspace benchmark measures primary artifact target separately from full validation", async () => {
  const spec = await loadWorkspaceSpec();
  const report = await benchmarkWorkspace({ spec, runs: 1 });

  assert.equal(report.runs, 1);
  assert.equal(report.summary.primaryArtifactTargetMs, 2500);
  assert.equal(report.summary.primaryArtifactHitRate, 1);
  assert.equal(report.summary.passRate, 1);
  assert.ok(report.results[0].primaryArtifactMs <= 2500);
});
