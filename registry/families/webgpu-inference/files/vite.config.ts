import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
  // WGSL files are imported with ?raw so Vite passes them through verbatim;
  // no loader plugin needed.
  assetsInclude: ['**/*.wgsl'],
})
