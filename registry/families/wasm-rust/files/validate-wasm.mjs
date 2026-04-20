// Structural validator for the wasm-rust starter. Does NOT run wasm-pack
// (that requires the Rust + wasm toolchain which scaffold validation runs
// without). Confirms the entry files exist and reference each other.

import fs from "node:fs/promises";

const [cargoToml, libRs, mainTs, viteConfig] = await Promise.all([
  fs.readFile("Cargo.toml", "utf8"),
  fs.readFile("src/lib.rs", "utf8"),
  fs.readFile("src/main.ts", "utf8"),
  fs.readFile("vite.config.ts", "utf8"),
]);

if (!cargoToml.includes('crate-type = ["cdylib", "rlib"]')) {
  throw new Error("Cargo.toml must declare cdylib for wasm-bindgen output");
}
if (!cargoToml.includes('wasm-bindgen')) {
  throw new Error("Cargo.toml missing wasm-bindgen dependency");
}
if (!libRs.includes('#[wasm_bindgen]')) {
  throw new Error("src/lib.rs must export at least one #[wasm_bindgen] function");
}
if (!mainTs.includes('./pkg/')) {
  throw new Error("src/main.ts must import the compiled wasm module from ./pkg/");
}
if (!viteConfig.includes('vite-plugin-wasm')) {
  throw new Error("vite.config.ts must include vite-plugin-wasm for WASM asset handling");
}

console.log("wasm-rust starter ok");
