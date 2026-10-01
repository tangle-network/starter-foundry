import { createRequire } from 'node:module'
import path from 'node:path'
import agentAppPreset from '@tangle-network/agent-app/tailwind-preset'
import sandboxUiPreset from '@tangle-network/sandbox-ui/tailwind'

const require = createRequire(import.meta.url)

const packageContent = (entrypoint, parent = '.') =>
  path.join(path.dirname(require.resolve(entrypoint)), parent, '**/*.{js,jsx,mjs,cjs}')

/** @type {import('tailwindcss').Config} */
export default {
  presets: [sandboxUiPreset, agentAppPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    packageContent('@tangle-network/agent-app/web-react', '..'),
    packageContent('@tangle-network/sandbox-ui/styles'),
    packageContent('@tangle-network/ui'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
