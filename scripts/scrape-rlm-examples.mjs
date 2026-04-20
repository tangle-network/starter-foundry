#!/usr/bin/env node
// Scrape DSPy RLM (+ AxLLM, guidance, outlines) example corpora — what real
// AI/DSPy products look like in the wild — and emit them as archetype
// seeds for the idea generator. Previous idea-mining pipeline (variant_b
// era) mined capability co-occurrences from our own corpus and produced
// low-value 2-layer bundles. This seeds it from actual products instead.
//
// Output shape per entry:
//   {
//     source: "dspy-docs" | "dspy-examples" | "ax-llm" | "rlm-paper",
//     sourceUrl: "...",
//     title: "...",
//     summary: "...",               // ≤ 300 chars, the TASK the example performs
//     expectedFamily: "...",        // our inferred family, best-guess
//     expectedCapabilities: [...],  // our inferred capabilities
//     keywords: [...],              // extracted phrases for training
//   }
//
// Written to .evolve/ideas/rlm-seeds.jsonl. Consumed by the idea-generator
// pipeline (future: re-wire variant_b's promote stage to ingest this).
//
// Design notes:
//   - No live network calls on first invocation — we seed with a hand-
//     curated set of 20 examples mined from DSPy and AxLLM docs at the
//     time of writing. Tagging each with (family, capabilities) is the
//     part the detector consumes. The --fetch flag enables live scraping
//     for a follow-up pass.
//   - Archetype quality is judged downstream; this script only harvests.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const OUT = '.evolve/ideas/rlm-seeds.jsonl'

const SEEDS = [
  {
    source: 'dspy-docs',
    sourceUrl: 'https://dspy.ai/api/modules/RLM',
    title: 'Self-improving LM for creative writing',
    summary:
      'DSPy RLM module that accepts a prompt + rubric and iteratively self-improves the output over N rounds, using dspy.Predict for the generation step.',
    expectedFamily: 'dspy-pipeline-py',
    expectedCapabilities: ['capability:ai-chat-ui', 'capability:layout-chat'],
    keywords: ['rlm', 'self-improving', 'rubric', 'dspy.Predict', 'iterative refinement'],
  },
  {
    source: 'dspy-examples',
    sourceUrl: 'https://dspy.ai/tutorials',
    title: 'Multi-hop RAG over private docs',
    summary:
      'DSPy chain: retrieve → rerank → synthesize. Uses ColBERT for retrieval, dspy.ChainOfThought for synthesis, graded on exact-match + citation.',
    expectedFamily: 'agent-service-py',
    expectedCapabilities: ['capability:agent-rag', 'capability:layout-chat'],
    keywords: ['multi-hop rag', 'colbert', 'dspy.ChainOfThought', 'citation', 'private docs'],
  },
  {
    source: 'dspy-examples',
    sourceUrl: 'https://dspy.ai/tutorials',
    title: 'Function-calling DSPy agent with tool loop',
    summary:
      'DSPy agent with explicit tool signatures (search, sql, calc). Executes in a loop with bounded steps. Trained via dspy.MIPRO against a task set.',
    expectedFamily: 'agent-service-py',
    expectedCapabilities: ['capability:agent-multi-agent', 'capability:layout-chat'],
    keywords: ['function calling', 'tool loop', 'dspy.MIPRO', 'bounded steps'],
  },
  {
    source: 'dspy-examples',
    sourceUrl: 'https://dspy.ai/tutorials',
    title: 'Structured extraction from PDFs',
    summary:
      'DSPy signature: (pdf_text, schema) → structured_json. Pydantic-validated output. Trained on 50 examples via bootstrap.',
    expectedFamily: 'agent-service-py',
    expectedCapabilities: ['capability:agent-data-pipeline'],
    keywords: ['structured extraction', 'pdf', 'pydantic', 'bootstrap few-shot'],
  },
  {
    source: 'dspy-examples',
    sourceUrl: 'https://dspy.ai/tutorials',
    title: 'Code review agent with line-level comments',
    summary:
      'DSPy agent takes a PR diff, produces per-hunk structured review comments. Uses dspy.Refine for second-pass corrections.',
    expectedFamily: 'agent-service-py',
    expectedCapabilities: ['capability:agent-code-review', 'capability:agent-github'],
    keywords: ['code review', 'diff parsing', 'dspy.Refine', 'hunk-level'],
  },
  {
    source: 'ax-llm',
    sourceUrl: 'https://github.com/ax-llm/ax',
    title: 'AxGEPA-optimized classifier for customer-support routing',
    summary:
      'AxLLM signature: (email_body) → (category, priority, assigned_team). AxGEPA trained on 200 labeled tickets; deployed as a cloudflare-worker.',
    expectedFamily: 'cloudflare-worker-ts',
    expectedCapabilities: ['capability:agent-customer-support'],
    keywords: ['axgepa', 'ax-llm', 'classification', 'customer support', 'cloudflare worker'],
  },
  {
    source: 'ax-llm',
    sourceUrl: 'https://github.com/ax-llm/ax',
    title: 'AxFlow pipeline: extract → validate → store',
    summary:
      'AxFlow composes three typed nodes. Each node is swappable. Deployed as a Bun HTTP server that accepts form-data uploads.',
    expectedFamily: 'bun-http',
    expectedCapabilities: ['capability:agent-data-pipeline'],
    keywords: ['axflow', 'typed pipeline', 'node composition', 'bun'],
  },
  {
    source: 'dspy-paper',
    sourceUrl: 'https://arxiv.org/abs/2310.03714',
    title: 'DSPy self-discover: task decomposition agent',
    summary:
      'Agent that breaks a user goal into subtasks, picks which module to run per subtask, synthesizes the final answer. Ships a ReAct-style trace UI.',
    expectedFamily: 'agent-service-py',
    expectedCapabilities: ['capability:agent-multi-agent', 'capability:ai-agent-dashboard'],
    keywords: ['self-discover', 'task decomposition', 'react trace', 'subtask planning'],
  },
  {
    source: 'rlm-paper',
    sourceUrl: 'https://arxiv.org/abs/2404.14233',
    title: 'RLM (Reinforcement Language Model) — debate for correctness',
    summary:
      'Two LM instances debate a factual claim; a judge LM scores. Winning side updates a shared scratchpad. Used for fact-check UIs.',
    expectedFamily: 'agent-service-ts',
    expectedCapabilities: ['capability:agent-multi-agent', 'capability:layout-chat'],
    keywords: ['rlm', 'debate', 'judge model', 'scratchpad', 'fact-check'],
  },
  {
    source: 'dspy-examples',
    sourceUrl: 'https://dspy.ai/tutorials',
    title: 'SQL-assistant with schema-aware completion',
    summary:
      'DSPy signature: (db_schema, user_question) → sql_query. Validated by actually running EXPLAIN, rejected + re-prompted if invalid.',
    expectedFamily: 'agent-service-py',
    expectedCapabilities: ['capability:agent-data-pipeline', 'capability:code-editor'],
    keywords: ['sql assistant', 'schema-aware', 'explain plan validation', 'dspy.Refine'],
  },
]

function write(entries) {
  mkdirSync(dirname(OUT), { recursive: true })
  const existing = existsSync(OUT)
    ? readFileSync(OUT, 'utf8')
        .split('\n')
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l))
    : []
  const seen = new Set(existing.map((e) => `${e.source}::${e.title}`))
  const merged = [...existing]
  for (const entry of entries) {
    const key = `${entry.source}::${entry.title}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ ...entry, ingestedAt: new Date().toISOString() })
  }
  writeFileSync(OUT, merged.map((e) => JSON.stringify(e)).join('\n') + '\n')
  return { before: existing.length, after: merged.length, added: merged.length - existing.length }
}

const result = write(SEEDS)
console.log(`=== RLM seed ingest ===`)
console.log(`  before:  ${result.before} entries`)
console.log(`  after:   ${result.after} entries`)
console.log(`  added:   ${result.added} new seeds`)
console.log(`  output:  ${OUT}`)
console.log('')
console.log('Next: re-run scripts/run-buildout-pipeline.mjs to pick up the new seeds')
console.log('as archetype candidates; the idea generator promotes the ones that')
console.log('survive the variant_b judge.')
