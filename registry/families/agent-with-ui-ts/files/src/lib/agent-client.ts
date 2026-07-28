import type { SdkSessionEvent } from '@tangle-network/sandbox-ui/hooks'

export interface InvokeAgentArgs {
  userText: string
  onEvent: (event: SdkSessionEvent) => void
  signal: AbortSignal
}

export const serverAgentInvoker = {
  async invoke({ userText, onEvent, signal }: InvokeAgentArgs): Promise<void> {
    const response = await fetch('/api/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: userText }),
      signal,
    })
    if (!response.ok) {
      const message = (await response.text()).trim()
      throw new Error(message || `Agent request failed with status ${response.status}`)
    }

    for await (const event of decodeEventStream(response)) {
      onEvent(event)
    }
  },
}

async function* decodeEventStream(response: Response): AsyncIterable<SdkSessionEvent> {
  if (!response.body) throw new Error('Agent response has no stream body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) yield parseEvent(line)
        newline = buffer.indexOf('\n')
      }
      if (done) break
    }

    const finalLine = buffer.trim()
    if (finalLine) yield parseEvent(finalLine)
  } finally {
    reader.releaseLock()
  }
}

function parseEvent(line: string): SdkSessionEvent {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    throw new Error('Agent stream returned invalid JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Agent stream returned a non-object event')
  }
  const event = value as Record<string, unknown>
  if (typeof event.type !== 'string' || event.type.length === 0) {
    throw new Error('Agent stream event is missing a type')
  }
  return value as SdkSessionEvent
}
