import { defineConfig } from 'vite'

// Unity 2021.2+ WebGL builds ship with multi-threading enabled by
// default, which requires SharedArrayBuffer, which requires the page to
// be served with these two headers (cross-origin isolation). Without
// them the Unity loader fails with a SharedArrayBuffer error before the
// first frame.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  server: {
    port: 5173,
    headers: crossOriginIsolation,
    // Unity's .data files are large; don't warn on them.
    fs: { strict: false },
  },
  preview: {
    headers: crossOriginIsolation,
  },
  build: {
    target: 'es2022',
    // The Unity Build/ directory is shipped as static assets — copy it
    // into dist/ on build so production serves the same layout.
    assetsInlineLimit: 0,
  },
  // Don't let Vite try to transform Unity's .framework.js or .wasm
  // bundles — they're pre-built by Unity and byte-identical.
  assetsInclude: ['**/*.wasm', '**/*.data', '**/*.symbols.json'],
})
