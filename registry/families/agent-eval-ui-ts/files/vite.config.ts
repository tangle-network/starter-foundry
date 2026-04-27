import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import type { Plugin } from 'vite'

// Dev-time middleware: serves trace data from AGENT_EVAL_TRACES_DIR over a
// small JSON API so the browser-bundled UI never needs Node fs. In production
// the operator should mount the same files behind a static host or a tiny
// API; the README documents both options.
function tracesApiPlugin(rootDir: string): Plugin {
  return {
    name: 'agent-eval-traces-api',
    configureServer(server) {
      server.middlewares.use('/__traces', (req, res) => {
        try {
          if (!fs.existsSync(rootDir)) {
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.end('{"missing":true,"dir":' + JSON.stringify(rootDir) + ',"files":[]}')
            return
          }
          const files: { path: string; content: string }[] = []
          const walk = (d: string) => {
            for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
              const full = path.join(d, entry.name)
              if (entry.isDirectory()) walk(full)
              else if (/\.(jsonl|json)$/.test(entry.name)) {
                files.push({ path: path.relative(rootDir, full), content: fs.readFileSync(full, 'utf8') })
              }
            }
          }
          walk(rootDir)
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ missing: false, dir: rootDir, files }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        }
      })
    },
  }
}

const TRACES_DIR =
  process.env.AGENT_EVAL_TRACES_DIR ?? path.resolve(process.cwd(), '{{tracesDir}}')

export default defineConfig({
  plugins: [react(), tracesApiPlugin(TRACES_DIR)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: {{port}},
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
