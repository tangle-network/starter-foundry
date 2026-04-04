// Types

export interface Chunk {
  id: string
  text: string
  index: number
  metadata?: Record<string, unknown>
}

export interface ScoredChunk {
  chunk: Chunk
  score: number
}

export interface RetrievalResult {
  query: string
  chunks: ScoredChunk[]
  context: string
  tokenEstimate: number
}

// Implementation

function estimateTokens(text: string): number {
  // Rough approximation: ~4 chars per token for English text
  return Math.ceil(text.length / 4)
}

export function chunkDocument(
  text: string,
  maxTokens: number = 512,
  overlapTokens: number = 64,
): Chunk[] {
  const paragraphs = text.split(/\n\s*\n/)
  const chunks: Chunk[] = []
  let currentChunkParts: string[] = []
  let currentTokens = 0
  let index = 0

  const flushChunk = () => {
    if (currentChunkParts.length === 0) return
    const chunkText = currentChunkParts.join('\n\n').trim()
    if (chunkText.length > 0) {
      chunks.push({
        id: `chunk-${index}`,
        text: chunkText,
        index,
      })
      index++
    }
  }

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (trimmed.length === 0) continue

    const paraTokens = estimateTokens(trimmed)

    // Single paragraph exceeds max: split by sentences
    if (paraTokens > maxTokens) {
      flushChunk()
      currentChunkParts = []
      currentTokens = 0

      const sentences = trimmed.split(/(?<=[.!?])\s+/)
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence)
        if (currentTokens + sentenceTokens > maxTokens && currentChunkParts.length > 0) {
          flushChunk()
          // Overlap: keep last part
          const overlapText = currentChunkParts.slice(-1)
          currentChunkParts = [...overlapText]
          currentTokens = estimateTokens(overlapText.join(' '))
        }
        currentChunkParts.push(sentence)
        currentTokens += sentenceTokens
      }
      continue
    }

    if (currentTokens + paraTokens > maxTokens && currentChunkParts.length > 0) {
      flushChunk()
      // Overlap: keep last paragraph
      const overlapParts = currentChunkParts.slice(-1)
      const overlapEst = estimateTokens(overlapParts.join('\n\n'))
      if (overlapEst <= overlapTokens) {
        currentChunkParts = [...overlapParts]
        currentTokens = overlapEst
      } else {
        currentChunkParts = []
        currentTokens = 0
      }
    }

    currentChunkParts.push(trimmed)
    currentTokens += paraTokens
  }

  flushChunk()
  return chunks
}

export function scoreChunks(query: string, chunks: Chunk[]): ScoredChunk[] {
  // BM25-style scoring
  const k1 = 1.2
  const b = 0.75
  const queryTerms = tokenize(query)
  const avgDocLen = chunks.reduce((s, c) => s + c.text.split(/\s+/).length, 0) / Math.max(chunks.length, 1)

  // Compute document frequency for each query term
  const df = new Map<string, number>()
  for (const term of queryTerms) {
    let count = 0
    for (const chunk of chunks) {
      if (tokenize(chunk.text).includes(term)) count++
    }
    df.set(term, count)
  }

  const N = chunks.length

  return chunks
    .map((chunk) => {
      const docTerms = tokenize(chunk.text)
      const docLen = docTerms.length
      const termFreq = new Map<string, number>()
      for (const t of docTerms) {
        termFreq.set(t, (termFreq.get(t) ?? 0) + 1)
      }

      let score = 0
      for (const term of queryTerms) {
        const tf = termFreq.get(term) ?? 0
        if (tf === 0) continue

        const docFreq = df.get(term) ?? 0
        const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1)
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)))
        score += idf * tfNorm
      }

      return { chunk, score }
    })
    .sort((a, b) => b.score - a.score)
}

export function buildContext(
  query: string,
  chunks: Chunk[],
  maxTokens: number = 2048,
): RetrievalResult {
  const scored = scoreChunks(query, chunks)
  const selected: ScoredChunk[] = []
  let tokenBudget = maxTokens
  let contextParts: string[] = []

  for (const item of scored) {
    if (item.score <= 0) break
    const tokens = estimateTokens(item.chunk.text)
    if (tokens > tokenBudget) continue
    selected.push(item)
    contextParts.push(`[Source ${item.chunk.id}]\n${item.chunk.text}`)
    tokenBudget -= tokens
  }

  const context = contextParts.join('\n\n---\n\n')
  return {
    query,
    chunks: selected,
    context,
    tokenEstimate: maxTokens - tokenBudget,
  }
}

// Internal helpers

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}
