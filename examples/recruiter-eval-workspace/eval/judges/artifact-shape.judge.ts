// Programmatic judge — no LLM call. Verifies the agent emitted an
// `:::artifact` block with a header line + non-empty body. Returns score
// 1.0 / 0.0 per turn; a single fail on any turn drops the scenario.
//
// Why programmatic: the artifact wrapper is a deterministic shape contract.
// No LLM judgment is needed; an LLM call here would be cost + variance for
// no signal.

import type { JudgeFn, JudgeScore } from '@tangle-network/agent-eval'

const ARTIFACT_BLOCK = /:::artifact\b([\s\S]*?):::/

const judge: JudgeFn = async (_tc, input): Promise<JudgeScore[]> => {
  const responses = input.turns.map((t) => t.agentResponse).join('\n\n---\n\n')
  const match = ARTIFACT_BLOCK.exec(responses)
  if (!match) {
    return [
      {
        judgeName: 'artifact-shape',
        dimension: 'artifact-shape',
        score: 0,
        reasoning: 'No `:::artifact ... :::` block found in any turn response.',
      },
    ]
  }
  const body = match[1].trim()
  // Header convention: first non-empty line should declare the artifact
  // (e.g. `# Job Description — Senior Backend Engineer — v0.1`).
  const firstLine = body.split('\n').find((l) => l.trim().length > 0) ?? ''
  const hasHeader = /^#+\s+\S/.test(firstLine)
  const longEnough = body.length >= 80
  if (!hasHeader) {
    return [
      {
        judgeName: 'artifact-shape',
        dimension: 'artifact-shape',
        score: 0,
        reasoning: `Artifact block found but first line is not a markdown header. Got: ${firstLine.slice(0, 60)}`,
        evidence: body.slice(0, 200),
      },
    ]
  }
  if (!longEnough) {
    return [
      {
        judgeName: 'artifact-shape',
        dimension: 'artifact-shape',
        score: 0,
        reasoning: `Artifact body is too short (${body.length} chars; expected ≥80).`,
        evidence: body,
      },
    ]
  }
  return [
    {
      judgeName: 'artifact-shape',
      dimension: 'artifact-shape',
      score: 1,
      reasoning: 'Artifact block present with header line and non-empty body.',
      evidence: body.slice(0, 240),
    },
  ]
}

export default judge
