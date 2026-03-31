import assert from "node:assert/strict";
import test from "node:test";
import { detectLane, getLaneKeywords, hasAny, matchesKeyword, countMatches, LANE_ROUTES } from "../dist/lib/keywords.js";

// matchesKeyword

test("matchesKeyword: exact single word", () => {
  assert.ok(matchesKeyword("build a golang api", "golang"));
  assert.ok(!matchesKeyword("build a golangapi", "golang")); // no boundary
});

test("matchesKeyword: phrase match (no boundary required)", () => {
  assert.ok(matchesKeyword("uses model context protocol for tools", "model context protocol"));
  assert.ok(!matchesKeyword("uses context protocol", "model context protocol"));
});

test("matchesKeyword: case-insensitive", () => {
  assert.ok(matchesKeyword("Build an EVM smart contract", "evm"));
  assert.ok(matchesKeyword("SOLIDITY contract", "solidity"));
});

test("matchesKeyword: hyphenated keyword matches substring", () => {
  assert.ok(matchesKeyword("add pay-per-request billing", "pay-per-request"));
  assert.ok(!matchesKeyword("pay-per-view", "pay-per-request"));
});

// hasAny / countMatches

test("hasAny: returns true on first match", () => {
  assert.ok(hasAny("build an eigenlayer avs", ["avs", "coprocessor avs"]));
  assert.ok(!hasAny("build a rest api", ["avs", "eigenlayer"]));
});

test("countMatches: counts all matching keywords", () => {
  assert.equal(countMatches("eigenlayer avs oracle avs", ["avs", "eigenlayer", "coprocessor"]), 2);
  assert.equal(countMatches("no matches here", ["avs", "eigenlayer"]), 0);
});

// LANE_ROUTES completeness

test("LANE_ROUTES covers expected lane ids", () => {
  const ids = LANE_ROUTES.map((r) => r.id);
  for (const id of ["tangle", "avs", "stylus", "zk", "mcp", "dspy", "agent", "x402", "evm-infra", "evm"]) {
    assert.ok(ids.includes(id), `missing lane: ${id}`);
  }
});

test("getLaneKeywords returns non-empty array for known lane", () => {
  assert.ok(getLaneKeywords("tangle").length > 0);
  assert.deepEqual(getLaneKeywords("unknown-lane"), []);
});

// detectLane — per-lane spot checks

test("detectLane: tangle", () => {
  assert.ok(detectLane("build a tangle blueprint", "tangle"));
  assert.ok(detectLane("oracle blueprint on tangle network", "tangle"));
  assert.ok(!detectLane("build a golang api", "tangle"));
});

test("detectLane: avs", () => {
  assert.ok(detectLane("create an eigenlayer avs service", "avs"));
  assert.ok(detectLane("keeper avs for mainnet", "avs"));
  assert.ok(!detectLane("build a rest api", "avs"));
});

test("detectLane: stylus", () => {
  assert.ok(detectLane("deploy a contract using arbitrum stylus", "stylus"));
  assert.ok(!detectLane("deploy a solidity contract", "stylus"));
});

test("detectLane: zk", () => {
  assert.ok(detectLane("build a zk prover using sp1", "zk"));
  assert.ok(detectLane("private voting with circom", "zk"));
  assert.ok(!detectLane("build a typescript api", "zk"));
});

test("detectLane: mcp", () => {
  assert.ok(detectLane("create an mcp server for my tools", "mcp"));
  assert.ok(detectLane("model context protocol tool server", "mcp"));
  assert.ok(!detectLane("build an api server", "mcp"));
});

test("detectLane: dspy", () => {
  assert.ok(detectLane("build a rag system with dspy", "dspy"));
  assert.ok(detectLane("text classification system", "dspy"));
  assert.ok(!detectLane("build a typescript api", "dspy"));
});

test("detectLane: agent excludes mcp and dspy", () => {
  assert.ok(detectLane("build an ai agent runtime", "agent"));
  assert.ok(!detectLane("build an mcp server with agent tools", "agent")); // mcp takes priority
  assert.ok(!detectLane("build a dspy ai agent pipeline", "agent")); // dspy takes priority
  assert.ok(!detectLane("build a go api", "agent"));
});

test("detectLane: x402", () => {
  assert.ok(detectLane("monetized api with x402 payments", "x402"));
  assert.ok(detectLane("pay-per-request micropayments api", "x402"));
  assert.ok(!detectLane("build a stripe subscription", "x402"));
});

test("detectLane: evm-infra", () => {
  assert.ok(detectLane("block monitor with viem and rpc endpoints", "evm-infra"));
  assert.ok(detectLane("monitor ethereum gas price", "evm-infra"));
  assert.ok(!detectLane("build a solidity contract", "evm-infra"));
});

test("detectLane: evm", () => {
  assert.ok(detectLane("deploy an erc20 token with foundry", "evm"));
  assert.ok(detectLane("smart contract on arbitrum with solidity", "evm"));
  assert.ok(!detectLane("build a go api", "evm"));
});

test("detectLane: unknown lane returns false", () => {
  assert.ok(!detectLane("build anything", "nonexistent-lane"));
});
