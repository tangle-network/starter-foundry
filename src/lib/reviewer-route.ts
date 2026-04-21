// Reviewer route selection shared by every propose/review adapter. Picks the
// highest-fidelity provider available: direct Anthropic → direct Groq →
// tangle-router (OpenAI-compatible, rate-limited on free tier). The router
// path is last because a local driver doesn't need the governance/billing
// plane — and its 6k TPM free-tier cap starves long runs.

export interface ReviewerRoute {
  url: string
  model: string
  style: 'anthropic' | 'openai'
  headers: Record<string, string>
}

export function selectReviewerRoute(overrideModel?: string | null): ReviewerRoute | null {
  const env = process.env
  if (env['ANTHROPIC_API_KEY']) {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      model: overrideModel ?? 'claude-sonnet-4-6',
      style: 'anthropic',
      headers: {
        'x-api-key': env['ANTHROPIC_API_KEY'],
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }
  }
  if (env['GROQ_API_KEY']) {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: overrideModel ?? 'llama-3.3-70b-versatile',
      style: 'openai',
      headers: {
        Authorization: `Bearer ${env['GROQ_API_KEY']}`,
        'content-type': 'application/json',
      },
    }
  }
  if (env['TANGLE_ROUTER_USER_KEY']) {
    return {
      url: 'https://router.tangle.tools/v1/chat/completions',
      model: overrideModel ?? 'llama-3.1-8b-instant',
      style: 'openai',
      headers: {
        Authorization: `Bearer ${env['TANGLE_ROUTER_USER_KEY']}`,
        'content-type': 'application/json',
      },
    }
  }
  return null
}

export async function reviewerJsonCall(
  route: ReviewerRoute,
  req: { system: string; user: string },
): Promise<unknown> {
  const body =
    route.style === 'anthropic'
      ? {
          model: route.model,
          system: req.system,
          messages: [{ role: 'user', content: `${req.user}\n\nReturn JSON only. No prose outside the object.` }],
          max_tokens: 2048,
          temperature: 0.2,
        }
      : {
          model: route.model,
          stream: false,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }
  const res = await fetch(route.url, {
    method: 'POST',
    headers: route.headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`reviewer ${res.status}: ${text.slice(0, 400)}`)
  }
  const json = (await res.json()) as Record<string, unknown>
  const content =
    route.style === 'anthropic'
      ? extractAnthropicText(json)
      : extractOpenAIText(json)
  if (typeof content !== 'string') throw new Error('reviewer returned no text content')
  // Strip fenced code blocks that sonnet sometimes wraps around JSON despite instruction.
  const stripped = content.trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
  return JSON.parse(stripped) as unknown
}

interface AnthropicContentBlock {
  type: string
  text?: string
}
function extractAnthropicText(json: Record<string, unknown>): string | undefined {
  const content = json['content']
  if (!Array.isArray(content)) return undefined
  for (const block of content as AnthropicContentBlock[]) {
    if (block.type === 'text' && typeof block.text === 'string') return block.text
  }
  return undefined
}

interface OpenAIChoice {
  message?: { content?: string }
}
function extractOpenAIText(json: Record<string, unknown>): string | undefined {
  const choices = json['choices']
  if (!Array.isArray(choices)) return undefined
  const first = choices[0] as OpenAIChoice | undefined
  return first?.message?.content
}
