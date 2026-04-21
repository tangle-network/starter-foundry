# Sample RAG corpus

Replace this file with your real documents. The pipeline ingests every `.md`,
`.txt`, and (with the `pdf` extra) `.pdf` file in this directory, chunks each
into overlapping windows, embeds every chunk, and stores the vectors in
Chroma. When you ask a question, the pipeline retrieves the top-K most
similar chunks by cosine similarity and feeds them to the LLM as grounded
context with a citation hint.

PagedAttention (used by vLLM) allocates KV cache in fixed-size pages instead
of one contiguous tensor per sequence. This lets the server pack many
concurrent requests into a single GPU — near-zero fragmentation, high batch
fill ratios, and throughput that scales with concurrency rather than
flatlining at batch size 1.
