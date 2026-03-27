import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createTempDir, removeDir, writeJson } from "../src/lib/fs.mjs";
import { runPromptCorpus } from "../src/lib/prompt-e2e.mjs";
import { planPrompt } from "../src/lib/prompt-planner.mjs";
import { runProofSuite } from "../src/lib/prove.mjs";

test("planPrompt routes simple prompts to starter families", async () => {
  const result = await planPrompt({
    prompt: "Build a Golang API risk engine with Postgres and Coinbase CDP support.",
    partner: "coinbase",
  });

  assert.equal(result.kind, "starter");
  assert.equal(result.spec.family, "go-api");
  assert.equal(result.spec.slots.database, "database:postgres");
  assert.equal(result.spec.slots.sdk, "sdk:coinbase-cdp");
});

test("planPrompt routes multiruntime prompts to workspaces", async () => {
  const result = await planPrompt({
    prompt: "Build a frontend product app with a Foundry treasury contract and a fast preview.",
    partner: "coinbase",
  });

  assert.equal(result.kind, "workspace");
  assert.equal(result.spec.launchPlan.primaryProjectId, "web");
  assert.ok(result.spec.projects.some((project) => project.id === "web"));
  assert.ok(result.spec.projects.some((project) => project.id === "evm"));
});

test("planPrompt routes mixed web and python api prompts to a workspace", async () => {
  const result = await planPrompt({
    prompt: "Create a Next.js marketing shell with a separate Python API for summarization jobs.",
    partner: null,
  });

  assert.equal(result.kind, "workspace");
  assert.equal(result.spec.launchPlan.primaryProjectId, "web");
  assert.equal(result.spec.projects.find((project) => project.id === "web")?.spec.family, "nextjs-ts");
  assert.equal(result.spec.projects.find((project) => project.id === "api")?.spec.family, "python-api");
});

test("planPrompt routes web plus worker prompts to a workspace", async () => {
  const result = await planPrompt({
    prompt: "Build a React operator console with a background worker that reacts to market streams.",
    partner: null,
  });

  assert.equal(result.kind, "workspace");
  assert.equal(result.spec.projects.find((project) => project.id === "web")?.spec.family, "react-vite-ts");
  assert.equal(result.spec.projects.find((project) => project.id === "worker")?.spec.family, "worker-job");
});

test("planPrompt carries auth, payments, and queue slots for starter prompts", async () => {
  const result = await planPrompt({
    prompt: "Build a fullstack SaaS control plane with Better Auth, Stripe subscriptions, and BullMQ background jobs.",
    partner: null,
  });

  assert.equal(result.kind, "starter");
  assert.equal(result.spec.family, "fullstack-ts");
  assert.equal(result.spec.slots.auth, "auth:better-auth");
  assert.equal(result.spec.slots.payments, "payments:stripe");
  assert.equal(result.spec.slots.queue, "queue:bullmq");
});

test("runPromptCorpus executes a tiny real prompt suite end to end", async () => {
  const outDir = await createTempDir("starter-foundry-prompt-corpus-test");
  const corpusPath = path.join(outDir, "tiny-corpus.json");

  try {
    await writeJson(corpusPath, {
      name: "tiny",
      scenarios: [
        {
          id: "frontend",
          complexity: "simple",
          partner: "coinbase",
          prompt: "Build a Coinbase landing page with charts and a fast preview.",
          expected: { kind: "starter", family: "frontend-static" },
        },
        {
          id: "multichain",
          complexity: "complex",
          partner: "coinbase",
          prompt: "Build a multichain product studio with a frontend plus Solidity, Solana, and Move contract lanes.",
          expected: { kind: "workspace", primaryProjectId: "web", projectIds: ["web", "evm", "solana", "move"] },
        },
      ],
    });

    const result = await runPromptCorpus({
      corpusPath,
      outDir,
    });

    assert.equal(result.report.summary.passRate, 1);
    assert.equal(result.report.summary.routeAccuracy, 1);
    assert.equal(result.report.summary.validationPassRate, 1);
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

test("runProofSuite summarizes coverage for a tiny corpus", async () => {
  const outDir = await createTempDir("starter-foundry-proof-suite-test");
  const corpusPath = path.join(outDir, "proof-corpus.json");

  try {
    await writeJson(corpusPath, {
      name: "proof-tiny",
      scenarios: [
        {
          id: "frontend",
          complexity: "simple",
          partner: "coinbase",
          prompt: "Build a Coinbase landing page with charts and a fast preview.",
          expected: { kind: "starter", family: "frontend-static" },
        },
        {
          id: "workspace",
          complexity: "complex",
          partner: null,
          prompt: "Build a React operator console with a background worker that reacts to market streams.",
          expected: {
            kind: "workspace",
            primaryProjectId: "web",
            projectIds: ["web", "worker"],
            projectFamilies: { web: "react-vite-ts", worker: "worker-job" },
          },
        },
      ],
    });

    const result = await runProofSuite({
      corpusPath,
      outDir,
    });

    assert.equal(result.report.summary.passRate, 1);
    assert.equal(result.report.coverage.kinds.starter, 1);
    assert.equal(result.report.coverage.kinds.workspace, 1);
    assert.ok(result.report.coverage.families.includes("frontend-static"));
    assert.ok(result.report.coverage.families.includes("worker-job"));
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
});
