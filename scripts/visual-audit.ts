#!/usr/bin/env node

/**
 * visual-audit.mjs — Compose a starter, install, start dev server, run bad design-audit.
 *
 * Usage:
 *   node scripts/visual-audit.ts                          # audit all frontend specs
 *   node scripts/visual-audit.ts --spec /tmp/spec.json    # audit one spec
 *   node scripts/visual-audit.ts --family react-vite-ts   # audit one family
 */

import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const badCli = path.resolve(repoRoot, '..', 'browser-agent-driver', 'dist', 'cli.js')
const port = 5299

const FRONTEND_SPECS = [
  {
    name: 'landing-default',
    spec: {
      projectName: 'landing-default',
      family: 'react-vite-ts',
      layers: ['framework:react-vite-ts', 'capability:tailwind', 'capability:shadcn', 'capability:layout-landing'],
      variables: { headline: 'Ship your product faster' },
    },
  },
  {
    name: 'landing-dark',
    spec: {
      projectName: 'alpha-project',
      family: 'react-vite-ts',
      layers: ['framework:react-vite-ts', 'capability:tailwind', 'capability:shadcn', 'capability:layout-landing'],
      variables: { headline: 'Ship your product faster' },
    },
  },
  {
    name: 'dashboard',
    spec: {
      projectName: 'dashboard-audit',
      family: 'nextjs-ts',
      layers: ['framework:nextjs-app-router', 'capability:tailwind', 'capability:shadcn', 'capability:layout-dashboard', 'capability:chart-widget'],
    },
  },
  {
    name: 'chat',
    spec: {
      projectName: 'chat-audit',
      family: 'react-vite-ts',
      layers: ['framework:react-vite-ts', 'capability:tailwind', 'capability:shadcn', 'capability:layout-chat'],
    },
  },
  {
    name: 'admin',
    spec: {
      projectName: 'admin-audit',
      family: 'react-vite-ts',
      layers: ['framework:react-vite-ts', 'capability:tailwind', 'capability:shadcn', 'capability:layout-admin'],
    },
  },
]

function kill(pid) {
  try { process.kill(pid, 'SIGTERM') } catch {}
}

async function auditSpec(name, spec) {
  const outDir = path.join('/tmp', `sf-visual-audit-${name}`)
  const specPath = path.join('/tmp', `sf-visual-spec-${name}.json`)

  await fs.rm(outDir, { recursive: true, force: true })
  await fs.writeFile(specPath, JSON.stringify(spec, null, 2))

  // Compose
  execSync(`node dist/cli.js compose --spec ${specPath} --out ${outDir}`, { cwd: repoRoot, stdio: 'pipe' })

  // Install
  execSync('pnpm install', { cwd: outDir, stdio: 'pipe', timeout: 60000 })

  // Start dev server
  const isVite = spec.family.includes('vite')
  const devCmd = isVite
    ? path.join(outDir, 'node_modules', '.bin', 'vite')
    : path.join(outDir, 'node_modules', '.bin', 'next')
  const devArgs = isVite ? ['--port', String(port)] : ['dev', '--port', String(port)]

  const server = spawn(devCmd, devArgs, { cwd: outDir, stdio: 'pipe' })

  // Wait for server ready
  await new Promise((resolve) => {
    const check = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:${port}`)
        if (res.ok) { clearInterval(check); resolve() }
      } catch {}
    }, 500)
    setTimeout(() => { clearInterval(check); resolve() }, 15000)
  })

  // Run audit
  let score = 0
  let findings = 0
  try {
    const result = execSync(
      `node ${badCli} design-audit --url http://localhost:${port} --profile vibecoded --pages 1 --json --headless`,
      { cwd: path.dirname(badCli), stdio: 'pipe', timeout: 120000 },
    ).toString()

    const scoreMatch = result.match(/(\d+)\/10/)
    const findingsMatch = result.match(/(\d+) findings/)
    score = scoreMatch ? parseInt(scoreMatch[1]) : 0
    findings = findingsMatch ? parseInt(findingsMatch[1]) : 0
  } catch (e) {
    score = 0
    findings = -1
  }

  kill(server.pid)
  return { name, score, findings }
}

async function main() {
  const args = process.argv.slice(2)

  let specs = FRONTEND_SPECS
  if (args.includes('--spec')) {
    const specPath = args[args.indexOf('--spec') + 1]
    const spec = JSON.parse(await fs.readFile(specPath, 'utf8'))
    specs = [{ name: path.basename(specPath, '.json'), spec }]
  }

  console.log(`Visual audit — ${specs.length} specs`)
  console.log('')

  const results = []
  for (const { name, spec } of specs) {
    process.stdout.write(`  ${name}...`)
    try {
      const result = await auditSpec(name, spec)
      results.push(result)
      console.log(` ${result.score}/10 (${result.findings} findings)`)
    } catch (e) {
      results.push({ name, score: 0, findings: -1 })
      console.log(` ERROR: ${e.message}`)
    }
  }

  console.log('')
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length
  console.log(`Average: ${avg.toFixed(1)}/10`)

  // Write results
  const resultsPath = path.join(repoRoot, '.evolve', 'visual-audit-results.json')
  await fs.mkdir(path.dirname(resultsPath), { recursive: true })
  await fs.writeFile(resultsPath, JSON.stringify({ timestamp: new Date().toISOString(), results, average: avg }, null, 2) + '\n')
  console.log(`Results → ${resultsPath}`)
}

main().catch(console.error)
