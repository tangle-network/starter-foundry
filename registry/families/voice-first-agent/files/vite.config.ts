import { defineConfig } from 'vite'

// Dev-server proxy forwards /api/* to whatever you wire in api/README.md
// (Whisper proxy, LLM endpoint, TTS endpoint). Swap the target for your
// backend URL when you stand one up.
export default defineConfig({
  server: {
    port: {{port}},
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
