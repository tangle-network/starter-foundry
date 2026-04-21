import { existsSync, readFileSync } from 'node:fs'

const must = (cond, msg) => {
  if (!cond) {
    console.error(`validate-observable: ${msg}`)
    process.exit(1)
  }
}

must(existsSync('observablehq.config.ts'), 'missing observablehq.config.ts')
must(existsSync('src/index.md'), 'missing src/index.md')
must(existsSync('src/overview.md'), 'missing src/overview.md')

const cfg = readFileSync('observablehq.config.ts', 'utf8')
must(/root:\s*['"]src['"]/.test(cfg), 'observablehq.config.ts must set root: "src"')
must(/output:\s*['"]dist['"]/.test(cfg), 'observablehq.config.ts must set output: "dist"')

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
must(pkg.dependencies?.['@observablehq/framework'], 'package.json must depend on @observablehq/framework')

const home = readFileSync('src/index.md', 'utf8')
must(/^---/m.test(home), 'src/index.md must have YAML frontmatter')

console.log('observable starter ok')
