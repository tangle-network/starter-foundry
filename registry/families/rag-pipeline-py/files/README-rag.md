# RAG pipeline — operator guide

End-to-end retrieval-augmented generation:

```
docs/*.md,.txt,.pdf
        │
        ▼
  chunk (800/120)
        │
        ▼
  sentence-transformers  ──►  Chroma (./chroma_db)
                                    │
                  query ────────────┤
                                    ▼
                           top-K retrieval
                                    │
                                    ▼
                             LLM synth (Ollama/vLLM)
```

## First-run

```bash
pip install -e .
cp .env.example .env
# Ensure Ollama is running + pulled:
ollama serve &
ollama pull llama3.1:8b

python -m src.pipeline index       # build the Chroma collection
python -m src.pipeline ask "what is paged attention?"
```

## Swapping components

- **Embedder**: change `EMBEDDING_MODEL` and delete `VECTOR_DB_DIR`. Popular
  choices: `BAAI/bge-small-en-v1.5` (better quality), `intfloat/e5-large-v2`
  (multilingual), `sentence-transformers/all-mpnet-base-v2` (bigger).
- **LLM**: point `LLM_BASE_URL` at any OpenAI-compatible endpoint — vLLM,
  TGI, LiteLLM, OpenAI, an internal gateway. `LLM_MODEL` is the id the
  endpoint accepts.
- **Vector DB**: the pipeline uses Chroma's `PersistentClient`. Swap to
  Qdrant / Weaviate / pgvector by replacing the `Chroma` usage in
  `src/pipeline.py`.

## Production notes

- **Rebuild on deploy**. Don't commit large Chroma directories — they go
  stale when docs change and inflate git.
- **Chunking matters more than the LLM**. Retrieval quality ceilings
  answer quality. Tune `CHUNK_SIZE` and `CHUNK_OVERLAP` per corpus shape.
- **Citations**: the default prompt requests `[doc:filename]` markers.
  Verify them in the response — hallucinated citations are a common LLM
  failure mode in RAG.
- **Batch the embedder** for large corpora (`SentenceTransformer.encode(..., batch_size=64)`).
  The default loop embeds one chunk at a time.
