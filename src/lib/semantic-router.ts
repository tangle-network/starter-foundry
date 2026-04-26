/**
 * Semantic Router — embedding-based family matching
 *
 * Used as a fallback when the keyword scorer is low-confidence.
 * Encodes family descriptions once at init, then compares against
 * user prompts via cosine similarity.
 *
 * Model: bge-small-en-v1.5 (17MB quantized, ~15ms per inference)
 * Dependencies: @huggingface/transformers (uses onnxruntime-node)
 */

import type { Registry, FamilyManifest } from '../types.js'

type EmbeddingPipeline = (
  text: string,
  options: { pooling: string; normalize: boolean },
) => Promise<{ data: Float32Array }>

let pipeline: EmbeddingPipeline | null = null
let familyEmbeddings: Map<string, Float32Array> | null = null
let initPromise: Promise<void> | null = null

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function embed(text: string): Promise<Float32Array> {
  if (!pipeline) throw new Error('Semantic router not initialized')
  const result = await pipeline(text, { pooling: 'mean', normalize: true })
  return new Float32Array(result.data)
}

/**
 * Initialize the embedding model and pre-compute family embeddings.
 * Call once at startup — subsequent calls are no-ops.
 * Takes ~300ms for model load + ~600ms for 39 family embeddings.
 */
export async function initSemanticRouter(registry: Registry): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      // Dynamic import with loose typing — the HF transformers API varies across versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hf: any = await import('@huggingface/transformers')
      const pipelineFn = hf.pipeline ?? hf.default?.pipeline
      if (!pipelineFn) {
        console.warn(
          'semantic-router: @huggingface/transformers pipeline not found, fallback disabled',
        )
        return
      }

      pipeline = (await pipelineFn('feature-extraction', 'Xenova/bge-small-en-v1.5', {
        quantized: true,
      })) as EmbeddingPipeline

      // Pre-compute embeddings for all family descriptions
      familyEmbeddings = new Map()
      for (const [id, family] of registry.families) {
        const desc = buildFamilyText(family)
        const embedding = await embed(desc)
        familyEmbeddings.set(id, embedding)
      }
    } catch (err) {
      console.warn(
        'semantic-router: initialization failed, fallback disabled',
        err instanceof Error ? err.message : err,
      )
      pipeline = null
      familyEmbeddings = null
    }
  })()

  return initPromise
}

/**
 * Build a rich text description of a family for embedding.
 * Includes description, tags, keywords, and taxonomy.
 */
function buildFamilyText(family: FamilyManifest): string {
  const parts = [family.description]
  if (family.tags?.length) parts.push(family.tags.join(', '))
  if (family.taxonomy) {
    if (family.taxonomy.language) parts.push(family.taxonomy.language)
    if (family.taxonomy.surface) parts.push(family.taxonomy.surface)
  }
  // Include tier1 keywords for stronger signal
  const tk = family.tieredKeywords
  if (tk?.tier1?.length) parts.push(tk.tier1.join(', '))
  return parts.join('. ')
}

interface SemanticMatch {
  familyId: string
  score: number
}

/**
 * Find the best matching family for a prompt using embedding similarity.
 * Returns null if the semantic router isn't initialized.
 * ~15ms per call (warm).
 */
export async function semanticMatch(prompt: string): Promise<SemanticMatch | null> {
  if (!pipeline || !familyEmbeddings) return null

  const promptEmbedding = await embed(prompt)

  let bestId = ''
  let bestScore = -1

  for (const [id, embedding] of familyEmbeddings) {
    const score = cosine(promptEmbedding, embedding)
    if (score > bestScore) {
      bestScore = score
      bestId = id
    }
  }

  if (!bestId) return null
  return { familyId: bestId, score: bestScore }
}

/** Returns true if the semantic router is ready. */
export function isSemanticRouterReady(): boolean {
  return pipeline !== null && familyEmbeddings !== null
}
