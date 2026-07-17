// Programmatic judge — no LLM call. Verifies the agent emitted an
// `:::artifact` block with a header line + non-empty body. Returns score
// 1.0 / 0.0 per turn; a single fail on any turn drops the scenario.
//
// Why programmatic: the artifact wrapper is a deterministic shape contract.
// No LLM judgment is needed; an LLM call here would be cost + variance for
// no signal.
//
// Regex shape (Gen-16.1 audit B2 fix): the artifact block convention puts
// `:::artifact` on its OWN line as the opener and `:::` on its own line as
// the terminator. The previous regex `:::artifact\b([\s\S]*?):::/` closed
// on any inline `:::` — including a `:::note` block inside the body, or
// the literal string `:::stop` written in the agent's response. The
// multiline anchor variant below requires line-anchored delimiters so an
// inline `:::` cannot terminate the block.

import type { JudgeFn, JudgeScore } from '@tangle-network/agent-eval'

/**
 * Line-anchored artifact block regex. Both `:::artifact` (the opener) and
 * the closing `:::` must sit on a line by themselves (with optional
 * trailing whitespace). The body is everything between, lazily matched.
 *
 * Multiline (`m` flag) anchors `^` and `$` to line starts/ends.
 */
const ARTIFACT_BLOCK = /^:::artifact\s*$\r?\n([\s\S]*?)\r?\n^:::\s*$/m

const judge: JudgeFn = async (_tc, input): Promise<JudgeScore[]> => {
  const responses = input.turns.map((t) => t.agentResponse).join('\n\n---\n\n')
  const match = ARTIFACT_BLOCK.exec(responses)
  if (!match) {
    return [
      {
        judgeName: 'artifact-shape',
        dimension: 'artifact-shape',
        score: 0,
        reasoning:
          'No `:::artifact` block found with line-anchored delimiters. Both opener `:::artifact` and closing `:::` must sit on their own line.',
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
export { ARTIFACT_BLOCK }
