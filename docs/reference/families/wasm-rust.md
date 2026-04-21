# Family: `wasm-rust`

Rust-compiled-to-WASM starter with wasm-bindgen bindings and a Vite frontend that loads + calls the module. For compute-heavy browser work (crypto primitives, image/video processing, physics, geometry, simulation) where JS throughput isn't enough.

**Taxonomy**: language=rust · runtime=wasm · surface=frontend

**Tags**: wasm, rust, webassembly, frontend

## When to use

Rust compiled to WASM + served by Vite. Use for compute-heavy browser workloads: crypto primitives, image/video processing, physics, geometry, scientific compute. Native-speed calls from React, 20-line API.

## First moves

- Install wasm-pack (required): `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
- Run `pnpm run build:wasm` BEFORE `pnpm dev` — Vite imports from ./pkg/ which only exists after wasm-pack runs.
- Extend `src/lib.rs` — annotate exports with `#[wasm_bindgen]`. Rust types auto-translate to JS (`&str` → string, `Vec<u8>` → Uint8Array).
- Call from TS: `import init, { myFn } from './pkg/<crateName>.js'` then `await init()` once at module top-level.
- Run native Rust tests via `cargo test` — they use the same src/lib.rs without WASM compilation.

## Gotchas

- Proving keys + ML weights are multi-MB — put them under `public/` (served as static assets), not imported as modules. Vite inlines imports <4KB and base64-bloats larger.
- wasm-bindgen types that contain references (&str, &[u8]) force a copy across the JS/WASM boundary. For hot loops, pass owned types (String, Vec<u8>).
- `top-level await` is required to await init() at module scope — vite-plugin-top-level-await is wired in vite.config.ts; don't remove it.
- The `pkg/` directory regenerates on every build. Do NOT edit generated files; they are overwritten.

## Placeholders (agent MUST replace)

- `src/lib.rs` — Default exports `greet()` and `fibonacci()` as demonstrations. Replace with the product's actual WASM-exposed API — each public function needs `#[wasm_bindgen]`.
- `src/main.ts` — Default DOM wiring that demos greet + fibonacci. Replace with the product's actual UI that calls the real WASM exports.

## Routing keywords

- **tier1**: wasm, webassembly, wasm-bindgen, wasm-pack
- **tier2**: rust wasm, rust in browser, browser wasm
- **archetypes**: image processing in browser, browser crypto, client-side video encoder, physics simulation, geometry engine, scientific computing web
