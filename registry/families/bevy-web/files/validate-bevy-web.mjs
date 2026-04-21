// Structural validator for the bevy-web starter. Does NOT run cargo or
// trunk (both require the Rust + wasm32 toolchain, which scaffold
// validation runs without). Confirms the Cargo/Trunk/main.rs wiring is
// internally consistent.

import fs from "node:fs/promises";

const [cargoToml, trunkToml, mainRs, indexHtml] = await Promise.all([
  fs.readFile("Cargo.toml", "utf8"),
  fs.readFile("Trunk.toml", "utf8"),
  fs.readFile("src/main.rs", "utf8"),
  fs.readFile("index.html", "utf8"),
]);

if (!/name\s*=\s*"\{\{crateName\}\}"/.test(cargoToml)) {
  throw new Error('Cargo.toml must declare `name = "{{crateName}}"`');
}
if (!/bevy\s*=/.test(cargoToml)) {
  throw new Error("Cargo.toml missing `bevy` dependency");
}
if (!cargoToml.includes('target_arch = "wasm32"')) {
  throw new Error("Cargo.toml should gate wasm32-specific deps under cfg(target_arch = \"wasm32\")");
}

if (!/target\s*=\s*"index\.html"/.test(trunkToml)) {
  throw new Error('Trunk.toml must set `target = "index.html"` under [build]');
}
if (!/dist\s*=\s*"dist"/.test(trunkToml)) {
  throw new Error('Trunk.toml must set `dist = "dist"` under [build]');
}

if (!mainRs.includes("App::new()")) {
  throw new Error("src/main.rs must construct a Bevy `App::new()`");
}
if (!mainRs.includes("DefaultPlugins")) {
  throw new Error("src/main.rs must register DefaultPlugins (or a narrower plugin group)");
}
if (!/fn\s+main\s*\(\s*\)/.test(mainRs)) {
  throw new Error("src/main.rs must declare `fn main()`");
}

if (!indexHtml.includes('data-trunk')) {
  throw new Error('index.html must include a <link data-trunk ...> directive so Trunk builds the crate');
}

console.log("bevy-web starter ok");
