import { existsSync, readFileSync } from 'node:fs'

const must = (cond, msg) => {
  if (!cond) {
    console.error(`validate-jupyter-book: ${msg}`)
    process.exit(1)
  }
}

must(existsSync('_config.yml'), 'missing _config.yml')
must(existsSync('_toc.yml'), 'missing _toc.yml')
must(existsSync('content/intro.md'), 'missing content/intro.md')
must(existsSync('content/chapter-1.md'), 'missing content/chapter-1.md')
must(existsSync('requirements.txt'), 'missing requirements.txt')

const cfg = readFileSync('_config.yml', 'utf8')
must(/^title:/m.test(cfg), '_config.yml must set title')

const toc = readFileSync('_toc.yml', 'utf8')
must(/^format:\s*jb-book/m.test(toc), '_toc.yml must declare format: jb-book')
must(/^root:/m.test(toc), '_toc.yml must set root')

const reqs = readFileSync('requirements.txt', 'utf8')
must(/jupyter-book/.test(reqs), 'requirements.txt must pin jupyter-book')

console.log('jupyter-book starter ok')
