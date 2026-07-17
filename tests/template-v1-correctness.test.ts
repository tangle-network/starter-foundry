// Tests for the template_v1 correctness detectors.
// Regresses the two bugs discovered 2026-04-21 when the pipeline shipped
// candidates that passed scoring + audit but were broken at use-time.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { composeStarter } from '../dist/lib/compose.js'
import { checkHtmlTsWireup, findUnusedImports } from '../dist/training/template_v1/correctness.js'

describe('findUnusedImports — catches the App.tsx bug (unused useState)', () => {
  it('flags a named import that never appears in the body', () => {
    const src = `
import { useState } from 'react'

export default function App() {
  return <div>hello</div>
}
`
    const out = findUnusedImports(src, 'src/App.tsx')
    assert.equal(out.length, 1)
    assert.equal(out[0]!.kind, 'unused-import')
    assert.match(out[0]!.detail, /useState/)
  })

  it('accepts a named import that IS referenced', () => {
    const src = `
import { useState } from 'react'

export default function App() {
  const [n, setN] = useState(0)
  return <div onClick={() => setN(n + 1)}>{n}</div>
}
`
    assert.deepEqual(findUnusedImports(src, 'src/App.tsx'), [])
  })

  it('accepts default + named imports when both are used', () => {
    const src = `
import React, { useState } from 'react'

export default function App() {
  const [n, setN] = useState(0)
  return React.createElement('div', { onClick: () => setN(n + 1) }, n)
}
`
    assert.deepEqual(findUnusedImports(src, 'src/App.tsx'), [])
  })

  it('flags the default binding when only the named binding is used', () => {
    const src = `
import React, { useState } from 'react'

export default function App() {
  const [n] = useState(0)
  return <div>{n}</div>
}
`
    const out = findUnusedImports(src, 'src/App.tsx')
    assert.equal(out.length, 1)
    assert.match(out[0]!.detail, /React/)
  })

  it('flags namespace imports when unused', () => {
    const src = `
import * as path from 'node:path'
import { readFileSync } from 'node:fs'

readFileSync('x.txt', 'utf8')
`
    const out = findUnusedImports(src, 'x.ts')
    assert.equal(out.length, 1)
    assert.match(out[0]!.detail, /path/)
  })

  it('skips side-effect imports', () => {
    const src = `
import './styles.css'
import 'polyfill/register'

export const x = 1
`
    assert.deepEqual(findUnusedImports(src, 'x.ts'), [])
  })

  it('ignores usages inside comments', () => {
    const src = `
import { useState } from 'react'

// we might add useState later but for now:
export default function App() { return <div /> }
`
    const out = findUnusedImports(src, 'src/App.tsx')
    assert.equal(out.length, 1)
    assert.match(out[0]!.detail, /useState/)
  })

  it('skips type-only imports (TypeScript handles those separately)', () => {
    const src = `
import type { FC } from 'react'
import { useState } from 'react'

const x: number = useState(0)[0]
`
    // FC is unused but type-only — skip. useState is used.
    assert.deepEqual(findUnusedImports(src, 'x.ts'), [])
  })
})

describe('checkHtmlTsWireup — catches the index.html bug (main.tsx/#root vs main.ts/#app)', () => {
  function setup(layout: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), 'sf-wireup-'))
    for (const [path, content] of Object.entries(layout)) {
      const abs = join(dir, path)
      mkdirSync(join(abs, '..'), { recursive: true })
      writeFileSync(abs, content)
    }
    return dir
  }

  it('flags when <script src> does not exist in the composed project', () => {
    const dir = setup({
      'index.html': `<!doctype html><html><body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body></html>`,
      'src/main.ts': `document.getElementById('root')`,
    })
    try {
      const out = checkHtmlTsWireup(dir)
      const missing = out.find((f) => f.kind === 'missing-script-src')
      assert.ok(missing, 'should flag the missing main.tsx')
      assert.match(missing!.detail, /main\.tsx/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('flags when document.getElementById() targets an id no HTML defines', () => {
    const dir = setup({
      'index.html': `<!doctype html><html><body>
        <div id="root"></div>
        <script type="module" src="/src/main.ts"></script>
      </body></html>`,
      'src/main.ts': `document.getElementById('app')`,
    })
    try {
      const out = checkHtmlTsWireup(dir)
      const mismatch = out.find((f) => f.kind === 'missing-element-id')
      assert.ok(mismatch, 'should flag that no HTML has id="app"')
      assert.match(mismatch!.detail, /'app'/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('accepts a consistent HTML + TS entry', () => {
    const dir = setup({
      'index.html': `<!doctype html><html><body>
        <div id="app"></div>
        <script type="module" src="/src/main.ts"></script>
      </body></html>`,
      'src/main.ts': `document.getElementById('app')!.innerHTML = 'ok'`,
    })
    try {
      assert.deepEqual(checkHtmlTsWireup(dir), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('passes when no HTML exists (backend scaffolds)', () => {
    const dir = setup({
      'src/server.ts': `export const x = 1`,
    })
    try {
      assert.deepEqual(checkHtmlTsWireup(dir), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ignores external <script src="https://...">', () => {
    const dir = setup({
      'index.html': `<!doctype html><html><body>
        <div id="app"></div>
        <script src="https://cdn.example.com/polyfill.js"></script>
        <script type="module" src="/src/main.ts"></script>
      </body></html>`,
      'src/main.ts': `document.getElementById('app')`,
    })
    try {
      assert.deepEqual(checkHtmlTsWireup(dir), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('regresses the exact two bugs shipped 2026-04-21', () => {
    // The actual failing candidate committed 0192839 (reverted) had
    // BOTH bugs in one file: <div id="root"> + main.tsx script, while
    // the scaffold uses <div id="app"> + main.ts mounted to #app.
    const dir = setup({
      'index.html': `<!doctype html><html><body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body></html>`,
      'src/main.ts': `document.getElementById('app')`,
    })
    try {
      const out = checkHtmlTsWireup(dir)
      // Expect TWO failures: missing script src + missing element id
      const kinds = out.map((f) => f.kind).sort()
      assert.deepEqual(kinds, ['missing-element-id', 'missing-script-src'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps the shipped react-vite-ts entry and mount point connected', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sf-react-wireup-'))
    try {
      await composeStarter({
        spec: {
          projectName: 'react-wireup-probe',
          family: 'react-vite-ts',
          layers: ['framework:react-vite-ts'],
        },
        outDir: dir,
      })

      assert.deepEqual(checkHtmlTsWireup(dir), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
