import { existsSync, readFileSync } from 'node:fs'

const must = (cond, msg) => {
  if (!cond) {
    console.error(`validate-hugo: ${msg}`)
    process.exit(1)
  }
}

must(existsSync('config.toml'), 'missing config.toml')
must(existsSync('content/_index.md'), 'missing content/_index.md home page')
must(existsSync('layouts/_default/baseof.html'), 'missing layouts/_default/baseof.html')
must(existsSync('layouts/index.html'), 'missing layouts/index.html')

const cfg = readFileSync('config.toml', 'utf8')
must(/^baseURL\s*=/m.test(cfg), 'config.toml must set baseURL')
must(/^title\s*=/m.test(cfg), 'config.toml must set title')

const home = readFileSync('content/_index.md', 'utf8')
must(/^---[\s\S]+---/m.test(home) || /^\+\+\+[\s\S]+\+\+\+/m.test(home), 'content/_index.md needs YAML or TOML frontmatter')

console.log('hugo starter ok')
