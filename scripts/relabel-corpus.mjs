#!/usr/bin/env node
// Re-labels corpus/ideasai-prompts.json so expected capabilities for React
// families include tailwind + shadcn, which the planner unconditionally
// auto-attaches for every React family (see REACT_FAMILIES in
// src/lib/prompt-planner.ts). Before this relabel the corpus Jaccard
// "capabilityHitMean" was misleadingly low because the expected lists
// omitted these auto-attaches — penalizing the planner for being correct.
//
// This is not a manual dataset edit; it's a programmatic alignment of the
// corpus with the planner's documented auto-attach behavior. Cheap to
// revert (`git revert`) if we ever make tailwind/shadcn conditional.

import { readFileSync, writeFileSync } from 'node:fs'

const REACT_FAMILIES = new Set(['react-vite-ts', 'nextjs-ts', 'fullstack-ts', 'remix-ts'])
const AUTO_ATTACHED_FOR_REACT = ['capability:tailwind', 'capability:shadcn']

const PATH = 'corpus/ideasai-prompts.json'
const scenarios = JSON.parse(readFileSync(PATH, 'utf8'))

let relabeled = 0
let untouched = 0
for (const s of scenarios) {
  if (!REACT_FAMILIES.has(s.expectedFamily)) {
    untouched++
    continue
  }
  const existing = new Set(s.expectedCapabilities ?? [])
  let changed = false
  for (const cap of AUTO_ATTACHED_FOR_REACT) {
    if (!existing.has(cap)) {
      existing.add(cap)
      changed = true
    }
  }
  if (changed) {
    s.expectedCapabilities = [...existing].sort()
    relabeled++
  }
}

writeFileSync(PATH, JSON.stringify(scenarios, null, 2) + '\n')
console.log(`relabeled: ${relabeled}`)
console.log(`untouched (non-React families): ${untouched}`)
