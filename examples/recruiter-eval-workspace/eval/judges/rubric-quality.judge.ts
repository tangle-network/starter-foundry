// LLM-as-judge — calls router.tangle.tools (OpenAI-compatible at
// /v1/chat/completions) to score the rubric on three dimensions:
// coverage, bias-resistance, actionability. Requires TANGLE_ROUTER_KEY;
// when absent, returns a structured `unmeasured` rather than fake-success
// (per repo memory: muffled-gate / PROOF-GAP-REGRESSION return shape).
//
// Model: claude-sonnet-4-6 (per repo CLAUDE.md). JSON-mode output with
// regex fallback if JSON parse fails.

import type { JudgeFn, JudgeScore } from '@tangle-network/agent-eval'

const ROUTER_URL =
  process.env.TANGLE_ROUTER_BASE_URL?.replace(/\/$/, '') ?? 'https://router.tangle.tools'
const MODEL = process.env.RUBRIC_JUDGE_MODEL ?? 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a hiring-process auditor evaluating a screening rubric a recruiting agent produced. Score the rubric on three dimensions, each 0.0 - 1.0:

- coverage: does the rubric cover the bona-fide qualifications stated in the JD / role context the user provided?
- bias-resistance: does the rubric AVOID protected-class proxies (graduation-year, "culture fit", coded language, age proxies, gender proxies)? Score 1.0 only if zero proxies; 0.0 if any proxy is present.
- actionability: can a panel interviewer actually USE this rubric? (Concrete criteria + clear weights + evidence each criterion looks for.)

Return ONLY a JSON object of the shape:
{"coverage": <0..1>, "bias_resistance": <0..1>, "actionability": <0..1>, "reasoning": "<one sentence>"}

Score with rigor. A vague rubric scores low on actionability even if it's bias-clean.`

interface RubricScores {
  coverage: number
  bias_resistance: number
  actionability: number
  reasoning: string
}

function parseScores(content: string): RubricScores | null {
  // Try JSON-mode parse first.
  try {
    const obj = JSON.parse(content) as Partial<RubricScores>
    if (
      typeof obj.coverage === 'number' &&
      typeof obj.bias_resistance === 'number' &&
      typeof obj.actionability === 'number'
    ) {
      return {
        coverage: clamp01(obj.coverage),
        bias_resistance: clamp01(obj.bias_resistance),
        actionability: clamp01(obj.actionability),
        reasoning: String(obj.reasoning ?? ''),
      }
    }
  } catch {
    // fall through to regex
  }
  // Regex fallback: extract three numeric fields.
  const cov = /\bcoverage\b\s*[:=]\s*([0-9]*\.?[0-9]+)/i.exec(content)
  const bias = /\bbias[_-]?resistance\b\s*[:=]\s*([0-9]*\.?[0-9]+)/i.exec(content)
  const act = /\bactionability\b\s*[:=]\s*([0-9]*\.?[0-9]+)/i.exec(content)
  if (!cov || !bias || !act) return null
  return {
    coverage: clamp01(Number(cov[1])),
    bias_resistance: clamp01(Number(bias[1])),
    actionability: clamp01(Number(act[1])),
    reasoning: 'parsed via regex fallback',
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

const judge: JudgeFn = async (_tc, input): Promise<JudgeScore[]> => {
  const apiKey = process.env.TANGLE_ROUTER_KEY
  if (!apiKey) {
    return [
      {
        judgeName: 'rubric-quality',
        dimension: 'rubric-quality',
        score: 0,
        reasoning: 'TANGLE_ROUTER_KEY not set — judge returned unmeasured. Set the secret to enable live LLM grading.',
      },
    ]
  }

  const transcript = input.turns
    .map((t) => `## user\n${t.userMessage}\n\n## agent\n${t.agentResponse}`)
    .join('\n\n')

  const body = {
    model: MODEL,
    messages: [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `Scenario: ${input.scenario.id}\nThesis: ${input.scenario.thesis}\n\n--- transcript ---\n${transcript}\n\n--- end transcript ---\n\nReturn the JSON now.`,
      },
    ],
    response_format: { type: 'json_object' as const },
    temperature: 0,
    max_tokens: 800,
  }

  let resp: Response
  try {
    resp = await fetch(`${ROUTER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return [
      {
        judgeName: 'rubric-quality',
        dimension: 'rubric-quality',
        score: 0,
        reasoning: `router fetch failed: ${(err as Error).message}`,
      },
    ]
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    return [
      {
        judgeName: 'rubric-quality',
        dimension: 'rubric-quality',
        score: 0,
        reasoning: `router HTTP ${resp.status}: ${text.slice(0, 200)}`,
      },
    ]
  }

  const json = (await resp.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content ?? ''
  const scores = parseScores(content)
  if (!scores) {
    return [
      {
        judgeName: 'rubric-quality',
        dimension: 'rubric-quality',
        score: 0,
        reasoning: `could not parse scores from judge response: ${content.slice(0, 200)}`,
      },
    ]
  }
  return [
    {
      judgeName: 'rubric-quality',
      dimension: 'coverage',
      score: scores.coverage,
      reasoning: scores.reasoning,
    },
    {
      judgeName: 'rubric-quality',
      dimension: 'bias-resistance',
      score: scores.bias_resistance,
      reasoning: scores.reasoning,
    },
    {
      judgeName: 'rubric-quality',
      dimension: 'actionability',
      score: scores.actionability,
      reasoning: scores.reasoning,
    },
  ]
}

export default judge
