const path = require('node:path')
const sandboxUiPreset = require('@tangle-network/sandbox-ui/tailwind')

const packageContent = (entrypoint, parent = '.') =>
  path.join(path.dirname(require.resolve(entrypoint)), parent, '**/*.{js,jsx,mjs,cjs}')

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [sandboxUiPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,html}',
    packageContent('@tangle-network/sandbox-ui/tailwind', 'dist'),
    packageContent('@tangle-network/ui'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
