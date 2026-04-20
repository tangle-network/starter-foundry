#!/usr/bin/env node
// Build the Rust crate to WASM using wasm-pack. Requires wasm-pack on PATH:
//   curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
//
// Output lands under ./pkg/ with type declarations + a loader module that
// Vite picks up via vite-plugin-wasm.

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "wasm-pack",
  ["build", "--target", "web", "--out-dir", "pkg", "--release"],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(
    "wasm-pack not found. Install with:\n  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh",
  );
  process.exit(1);
}
process.exit(result.status ?? 0);
