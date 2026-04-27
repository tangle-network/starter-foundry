import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Vite builds the React admin UI into dist/client/. The Cloudflare Worker
// (src/worker/index.ts) serves /api/* via Hono and falls back to that
// dist/client/ assets bundle for everything else. ONE worker, ONE deploy.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@worker': path.resolve(__dirname, 'src/worker'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: {{port}},
    // Local dev: proxy /api/* to wrangler dev's worker (default 8787).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
