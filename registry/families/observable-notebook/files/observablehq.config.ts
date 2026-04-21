import type { Config } from '@observablehq/framework'

const config: Config = {
  title: '{{headline}}',
  root: 'src',
  output: 'dist',
  theme: 'default',
  pages: [
    { name: 'Home', path: '/' },
    { name: 'Overview', path: '/overview' },
  ],
  footer: '{{subheadline}}',
}

export default config
