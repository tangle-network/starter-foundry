import { existsSync, readFileSync } from 'node:fs'

const must = (cond, msg) => {
  if (!cond) {
    console.error(`validate-zola: ${msg}`)
    process.exit(1)
  }
}

must(existsSync('config.toml'), 'missing config.toml')
must(existsSync('content/_index.md'), 'missing content/_index.md')
must(existsSync('templates/index.html'), 'missing templates/index.html')
must(existsSync('sass/main.scss'), 'missing sass/main.scss')

const cfg = readFileSync('config.toml', 'utf8')
must(/^base_url\s*=/m.test(cfg), 'config.toml must set base_url (Zola uses snake_case)')
must(/^title\s*=/m.test(cfg), 'config.toml must set title')
must(/compile_sass\s*=\s*true/.test(cfg), 'config.toml should enable compile_sass for the built-in SASS pipeline')

const home = readFileSync('content/_index.md', 'utf8')
must(/^\+\+\+[\s\S]+\+\+\+/m.test(home), 'content/_index.md must use Zola TOML frontmatter (+++ ... +++)')

console.log('zola starter ok')
