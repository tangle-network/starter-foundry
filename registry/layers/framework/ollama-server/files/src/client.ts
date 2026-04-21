// Minimal streaming client for a local Ollama server.
// Replace the prompt + response handler with the product's actual LLM call flow.

const BASE_URL = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434'
const MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2'

interface GenerateChunk {
  response?: string
  done: boolean
  total_duration?: number
  eval_count?: number
}

async function generate(prompt: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: true }),
  })

  if (!res.ok || !res.body) throw new Error(`ollama /api/generate ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let tokens = 0

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // NDJSON: split on newline, keep the trailing partial line.
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line) continue
      const chunk = JSON.parse(line) as GenerateChunk
      if (chunk.response) {
        process.stdout.write(chunk.response)
        tokens++
      }
      if (chunk.done) {
        process.stdout.write(`\n\n[${tokens} tokens, ${Math.round((chunk.total_duration ?? 0) / 1e6)}ms]\n`)
      }
    }
  }
}

generate('Explain starter-foundry in one sentence.').catch((err) => {
  console.error(err)
  process.exit(1)
})
