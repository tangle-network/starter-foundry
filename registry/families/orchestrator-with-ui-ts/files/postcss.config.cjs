const { createRequire } = require('node:module')
const path = require('node:path')

const packageRequire = createRequire(__filename)
const packageStyles = new Set([
  '@tangle-network/agent-app/styles',
  '@tangle-network/sandbox-ui/tokens.css',
])

module.exports = {
  plugins: {
    'postcss-import': {
      resolve: (id, basedir) => {
        if (packageStyles.has(id)) {
          return packageRequire.resolve(id, { paths: [basedir] })
        }
        return path.resolve(basedir, id)
      },
    },
    tailwindcss: { config: './tailwind.config.mjs' },
    autoprefixer: {},
  },
}
