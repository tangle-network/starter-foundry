import { defineConfig } from 'astro/config'

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  output: 'static',
  site: 'https://example.com',
  server: {
    port: {{port}},
    host: true,
  },
  build: {
    format: 'directory',
  },
})
