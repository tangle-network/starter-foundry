#!/usr/bin/env node
// Opens PRs from proposals produced by propose-capabilities.mjs and
// propose-family.mjs. Single entrypoint so the cron workflow can
// invoke one script per kind instead of maintaining branch/PR logic
// in each proposer.
//
// Usage:
//   node scripts/open-proposal-prs.mjs --kind capability [--min-confidence 0.75]
//   node scripts/open-proposal-prs.mjs --kind family [--min-confidence 0.75]
//
// Requires GITHUB_TOKEN in env (provided by actions/checkout or gh CLI).
// Silently skips if proposal files don't exist (cron can run before the
// first proposer has populated them).

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
function arg(k, fallback = null) {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : fallback
}

const kind = arg('--kind')
const minConfidence = parseFloat(arg('--min-confidence', '0.75'))
if (!kind || !['capability', 'family'].includes(kind)) {
  console.error('usage: open-proposal-prs.mjs --kind capability|family [--min-confidence 0.75]')
  process.exit(2)
}

const REPO_ROOT = resolve(process.cwd())

function git(args, opts = {}) {
  const res = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', ...opts })
  if (res.status !== 0 && !opts.allowFail) {
    console.error(`git ${args.join(' ')} failed:\n${res.stderr}`)
    process.exit(res.status ?? 1)
  }
  return res.stdout?.trim() ?? ''
}

function gh(args, opts = {}) {
  const res = spawnSync('gh', args, { cwd: REPO_ROOT, encoding: 'utf8', ...opts })
  if (res.status !== 0 && !opts.allowFail) {
    console.error(`gh ${args.join(' ')} failed:\n${res.stderr}`)
    process.exit(res.status ?? 1)
  }
  return res.stdout?.trim() ?? ''
}

function loadCapabilityProposals() {
  const path = resolve(REPO_ROOT, '.evolve/proposals/capabilities.json')
  if (!existsSync(path)) return []
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(data) ? data : (data.proposals ?? [])
  } catch (err) {
    console.error(`failed to parse ${path}: ${err.message}`)
    return []
  }
}

function loadFamilyProposals() {
  const dir = resolve(REPO_ROOT, '.evolve/family-proposals')
  if (!existsSync(dir)) return []
  // Each subdirectory == a single proposal with manifest.json + files/.
  const { readdirSync, statSync } = require('node:fs')
  const subs = readdirSync(dir).filter((n) => {
    try {
      return statSync(resolve(dir, n)).isDirectory()
    } catch {
      return false
    }
  })
  return subs.map((name) => ({
    id: name,
    dir: resolve(dir, name),
    confidence: 0.8, // family proposer emits 1-per-dir with implicit high confidence
  }))
}

const proposals = kind === 'capability' ? loadCapabilityProposals() : loadFamilyProposals()

if (proposals.length === 0) {
  console.log(`no ${kind} proposals available (file/dir missing or empty) — nothing to do`)
  process.exit(0)
}

const highConfidence = proposals.filter((p) => (p.confidence ?? 0) >= minConfidence)
console.log(
  `${proposals.length} ${kind} proposal(s); ${highConfidence.length} above confidence ${minConfidence}`,
)

if (highConfidence.length === 0) {
  console.log('nothing above confidence threshold — exiting without opening PRs')
  process.exit(0)
}

// Dedup: skip proposals where a branch already exists (avoid opening
// the same PR every run).
const existingBranches = new Set(
  git(['ls-remote', '--heads', 'origin'])
    .split('\n')
    .map((line) => line.split('\t')[1]?.replace('refs/heads/', ''))
    .filter(Boolean),
)

let openedCount = 0
let skippedCount = 0
const errors = []

for (const proposal of highConfidence) {
  const slug =
    kind === 'capability' ? `capability-${proposal.id ?? proposal.name}` : `family-${proposal.id}`
  const branch = `proposal/${slug}`
  if (existingBranches.has(branch)) {
    console.log(`  skip ${branch}: branch already exists on origin`)
    skippedCount++
    continue
  }

  try {
    // The actual file-write work lives in the proposer scripts; they
    // should have staged changes into .evolve/ already. This script
    // just opens the PR. Propose-family writes under
    // .evolve/family-proposals/<id>/; propose-capabilities writes a
    // single JSON. We cherry-pick those into a branch.
    git(['checkout', '-B', branch, 'origin/main'])
    // NB: the proposer is responsible for producing git-ready diffs.
    // Here we only stage + commit whatever exists under .evolve/proposals
    // or .evolve/family-proposals/<id>/ for this proposal.
    if (kind === 'capability') {
      git(['add', '.evolve/proposals/'], { allowFail: true })
    } else {
      git(['add', `.evolve/family-proposals/${proposal.id}/`], { allowFail: true })
    }
    const status = git(['status', '--porcelain'])
    if (!status.trim()) {
      console.log(`  skip ${branch}: no staged changes`)
      skippedCount++
      continue
    }
    git(['commit', '-m', `proposal(${kind}): ${proposal.id ?? proposal.name}`])
    git(['push', '-u', 'origin', branch, '--force'])

    gh([
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      branch,
      '--title',
      `proposal(${kind}): ${proposal.id ?? proposal.name}`,
      '--body',
      renderBody(kind, proposal),
    ])
    openedCount++
    console.log(`  opened PR for ${branch}`)
  } catch (err) {
    errors.push({ branch, message: err.message })
  }
}

git(['checkout', 'main'], { allowFail: true })

console.log(`\nopened ${openedCount} PR(s); skipped ${skippedCount}; errors ${errors.length}`)
if (errors.length > 0) {
  for (const e of errors) console.error(`  ${e.branch}: ${e.message}`)
  process.exit(1)
}

function renderBody(kind, proposal) {
  if (kind === 'capability') {
    return [
      '## Capability proposal (auto-generated)',
      '',
      `**Proposed ID**: \`capability:${proposal.id ?? proposal.name}\``,
      `**Confidence**: ${(proposal.confidence * 100).toFixed(0)}%`,
      `**Source signal**: ${proposal.sourceSignal ?? 'unmapped package cluster from buildout-analysis'}`,
      '',
      '### What this proposes',
      proposal.description ?? '(no description emitted)',
      '',
      '### Evidence',
      `- Detected in ${proposal.occurrenceCount ?? '?'} buildouts`,
      `- Packages: ${(proposal.packages ?? []).map((p) => `\`${p}\``).join(', ')}`,
      '',
      '### Review checklist',
      '- [ ] Capability name follows naming convention (`capability:<slug>`)',
      '- [ ] `appliesTo` covers the right families',
      '- [ ] `packageDeps` declares all inferred deps',
      '- [ ] `tieredKeywords` covers the signal phrases',
      '',
      'Generated by the nightly proposal cron. Merge or close based on review.',
    ].join('\n')
  }
  return [
    '## Family proposal (auto-generated)',
    '',
    `**Proposed family**: \`${proposal.id}\``,
    `**Confidence**: ${(proposal.confidence * 100).toFixed(0)}%`,
    '',
    '### What this proposes',
    `New family scaffold emitted at \`.evolve/family-proposals/${proposal.id}/\`. Review the manifest + files/ contents and if good, copy into \`registry/families/${proposal.id}/\` and \`registry/layers/framework/${proposal.id}/\`.`,
    '',
    '### Review checklist',
    '- [ ] Manifest validates (`node scripts/validate-registry.mjs`)',
    '- [ ] `appliesTo` matches a real framework id',
    '- [ ] Scaffold composes + installs + typechecks',
    '- [ ] Keywords don\'t collide with existing families',
    '',
    'Generated by the nightly proposal cron. If the proposal looks good, the last step is to move files into the canonical registry path and resubmit.',
  ].join('\n')
}
