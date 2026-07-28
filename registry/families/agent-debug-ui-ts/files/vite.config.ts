import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PORT')
  const apiPort = Number(env.API_PORT || 8787)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 4180,
      proxy: {
        '/api': `http://127.0.0.1:${apiPort}`,
      },
    },
  }
})
