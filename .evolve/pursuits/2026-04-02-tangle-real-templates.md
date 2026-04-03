# Pursuit: Real Tangle Blueprint Templates + Crate Publishing
Generation: 10
Date: 2026-04-02 — 2026-04-03
Status: partial (templates shipped, publishing blocked)

## Changes Shipped

### 1. Tangle blueprint rewritten to real workspace structure
- Was: single-crate toy project with sync `run_job` function
- Now: Cargo workspace matching ~/code/blueprint-template exactly
  - `{{packageName}}-lib/` — Router, TangleArg/TangleResult job handlers, serde types
  - `{{packageName}}-bin/` — BlueprintRunner, TangleProducer/Consumer, keystore, signer
  - `contracts/src/HelloBlueprint.sol` — Solidity service manager with tnt-core
  - `rust-toolchain.toml`, `.cargo/config.toml`, `foundry.toml`

### 2. crateName template variable
- Added `crateName` (hyphens → underscores) to `buildVariables()` in registry.ts
- Required for valid Rust `use` statements in bin crate

### 3. Capability layers updated
- tangle-oracle and tangle-custody now target `{{packageName}}-lib/src/lib.rs`
- Both use real blueprint-sdk API (Router, TangleArg, TangleResult, Caller)

### 4. Cargo warm script reads from warm list
- Was: hardcoded 10-crate Cargo.toml
- Now: dynamically generates Cargo.toml from all `crates:` entries in cache-warm-list.json

### 5. CI publish workflow added to blueprint repo
- `.github/workflows/publish-crates.yml` — workflow_dispatch trigger
- Merged to main via PR #1354

## Blocked

### Crate publishing
- blueprint-sdk 0.2.0-alpha.1 tags exist on GitHub (created 2026-03-21)
- Crates.io still has 0.1.0-alpha.22
- CARGO_REGISTRY_TOKEN doesn't have crate ownership
- Crate owners: shekohex, Tjemmmic
- Need one of them to either share token or add org account as owner

## Test Results
- 200/200 coverage + validation tests pass
- 284/284 total tests pass across all test files
