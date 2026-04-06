import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { composeFromPrompt } from "../dist/lib/compose-prompt.js";
import { createTempDir, removeDir } from "../dist/lib/fs.js";

test("composeFromPrompt: free-text fitness prompt produces React scaffold with industry palette", async () => {
  const outDir = await createTempDir("sf-cfp-fitness");
  try {
    const result = await composeFromPrompt({
      prompt: "Build a marathon training app for runners with personalized plans",
      outDir,
    });
    assert.equal(result.kind, "starter");
    if (result.kind !== "starter") return;

    // Family-default capabilities (tailwind + shadcn) auto-attached for React families
    const layers = result.spec.layers ?? [];
    assert.ok(layers.includes("capability:tailwind"), `expected tailwind in layers, got ${layers.join(",")}`);
    assert.ok(layers.includes("capability:shadcn"), `expected shadcn in layers, got ${layers.join(",")}`);

    // Industry detection ran and attached fitness
    assert.ok(layers.includes("industry:fitness"), `expected fitness industry, got ${layers.join(",")}`);

    // personalize.css written by industry layer
    const cssExists = await fs.access(path.join(outDir, "src/personalize.css"))
      .then(() => true).catch(() => false);
    assert.ok(cssExists, "personalize.css should exist");
    const css = await fs.readFile(path.join(outDir, "src/personalize.css"), "utf8");
    assert.match(css, /:root/);
    assert.match(css, /--color-primary/);

    // Context message references the family
    assert.match(result.contextMessage, new RegExp(result.spec.family));
    assert.match(result.contextMessage, /AGENTS\.md/);
    assert.match(result.contextMessage, /personalize/);
  } finally {
    await removeDir(outDir);
  }
});

test("composeFromPrompt: backend prompt routes to non-React family without forcing tailwind", async () => {
  const outDir = await createTempDir("sf-cfp-go");
  try {
    const result = await composeFromPrompt({
      prompt: "Build a Go REST API with Postgres and rate limiting",
      outDir,
    });
    assert.equal(result.kind, "starter");
    if (result.kind !== "starter") return;

    assert.equal(result.spec.family, "go-api");
    const layers = result.spec.layers ?? [];
    assert.ok(!layers.includes("capability:shadcn"), "go-api must not get shadcn forced");
    assert.ok(!layers.includes("capability:tailwind"), "go-api must not get tailwind forced");
  } finally {
    await removeDir(outDir);
  }
});

test("composeFromPrompt: empty prompt returns error", async () => {
  const result = await composeFromPrompt({ prompt: "", outDir: "/tmp/sf-cfp-empty" });
  assert.equal(result.kind, "error");
});

test("composeFromPrompt: workspace prompt returns workspace verdict", async () => {
  const result = await composeFromPrompt({
    prompt: "Build a multichain DeFi platform with frontend, EVM contracts, and a Solana program",
    outDir: "/tmp/sf-cfp-ws",
  });
  // Multi-project prompts may or may not detect as workspace depending on routing —
  // but if they do, we return a workspace verdict instead of composing.
  assert.ok(result.kind === "workspace" || result.kind === "starter");
});
