# Pursuit: Semantic Routing (Hybrid Keyword + Embedding)
Generation: 7
Date: 2026-04-01
Status: building

## Diagnosis

The keyword scorer works for 95% of prompts. The remaining 5% fail because:
1. Keywords collide across families (fhenix in ZK lane)
2. Product descriptions use vocabulary not in any keyword list
3. 12 lane override blocks in planPrompt bypass the scorer, creating a second routing system

Adding more keywords creates more collisions. Lane overrides are the legacy architecture we should delete, not maintain.

## Generation 7 Design

### Thesis
**Replace the 12 lane overrides with an embedding fallback that understands what families ARE, not just what keywords they have.**

### Architecture

```
User prompt
  → Tiered keyword scorer (~0.3ms)
  → If score > threshold (high confidence): use keyword result ✓
  → If score ≤ threshold (low confidence): embedding similarity fallback (~15ms)
      → Encode prompt + all 39 family descriptions
      → Cosine similarity picks best match
  → Capability detection (unchanged, from manifests)
  → Done
```

The embedding model runs ONCE at startup (load ONNX session). Subsequent inferences are ~15ms.

### What gets deleted
- 12 lane override blocks in planPrompt (tangle, eigenlayer, stylus, zk, mcp, dspy, x402, hardhat/forge, agent, solana, evm-infra, rust)
- These are ALL replaced by: "the tiered scorer is confident" OR "the embedding fallback picks the right family"

### What stays
- Tiered keyword scoring (fast path, handles 90% of prompts)
- Workspace builder (different problem — multi-project detection)
- Capability detection from manifests
- Build plan generation
- Fuzzy matching for typos

### Model choice
- `Xenova/bge-small-en-v1.5` (int8 quantized, 17MB)
- 384 dimensions
- 10-18ms per inference warm
- Runs in Node.js via @huggingface/transformers + onnxruntime-node
- No GPU, no Python, no API calls

### Success criteria
- Lane overrides: 12 → 0
- 103/103 corpus maintained
- 260 real-world prompts: 95% → ≥95%
- Latency (keyword-confident): <1ms (no change)
- Latency (embedding fallback): <20ms
- No new keyword additions needed for new families — embedding handles them automatically
