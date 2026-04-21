import { existsSync, readFileSync } from 'node:fs'

const must = (cond, msg) => {
  if (!cond) {
    console.error(`validate-eleventy: ${msg}`)
    process.exit(1)
  }
}

must(existsSync('.eleventy.js'), 'missing .eleventy.js config')
must(existsSync('src/index.md'), 'missing src/index.md entry page')
must(existsSync('src/_includes/base.njk'), 'missing src/_includes/base.njk layout')

const config = readFileSync('.eleventy.js', 'utf8')
must(/input:\s*['"]src['"]/.test(config), '.eleventy.js must declare dir.input = "src"')
must(/output:\s*['"]_site['"]/.test(config), '.eleventy.js must declare dir.output = "_site"')

const index = readFileSync('src/index.md', 'utf8')
must(/^---/m.test(index), 'src/index.md must have YAML frontmatter')
must(/layout:\s*base\.njk/.test(index), 'src/index.md must set layout: base.njk')

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
must(pkg.devDependencies?.['@11ty/eleventy'], 'package.json must depend on @11ty/eleventy')

console.log('eleventy starter ok')
