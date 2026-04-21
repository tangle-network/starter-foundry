# RAG Pipeline — Agent Guide

## What this project does
End-to-end retrieval-augmented generation: ingest local docs → chunk → embed → Chroma → retrieve top-k → grounded LLM answer.

## Install
```bash
pip install -e .
cp .env.example .env   # configure LLM_BASE_URL, LLM_MODEL, EMBEDDING_MODEL, VECTOR_DB_DIR
```

## Key commands
| Command | What it does |
|---------|-------------|
| `python -m src.pipeline index` | Ingest `docs/` into Chroma (rebuilds collection from scratch) |
| `python -m src.pipeline ask "<question>"` | Retrieve top-k chunks and synthesize a grounded answer |

## Environment variables (`.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `http://localhost:11434` | Ollama or any OpenAI-compatible server |
| `LLM_MODEL` | `llama3.1:8b` | Model name passed to the LLM |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Local embedding model |
| `VECTOR_DB_DIR` | `./chroma_db` | On-disk Chroma persistence directory |
| `COLLECTION_NAME` | `rag-docs` | Chroma collection name |
| `DOCS_DIR` | `./docs` | Source corpus root |
| `CHUNK_SIZE` | `800` | Character chunk size |
| `CHUNK_OVERLAP` | `120` | Character overlap between chunks |
| `TOP_K` | `4` | Chunks retrieved per query |

## Architecture
```
docs/ ──► _load_docs() ──► _chunk() ──► SentenceTransformer.encode() ──► chromadb
                                                                               │
query ─────────────────────────────────────────────────────────────► retrieve (top-k)
                                                                               │
                                                                          _llm_chat()
                                                                               │
                                                                           answer
```

## Entry point
`src/pipeline.py` — single file, all logic: `index()`, `retrieve()`, `ask()`, `main()`.

## Extending
- **Add docs**: drop `.md`, `.txt`, or `.pdf` files into `docs/` and re-run `index`.
- **Change LLM**: set `LLM_BASE_URL` + `LLM_MODEL` in `.env` — any OpenAI-compatible endpoint works.
- **Change embeddings**: update `EMBEDDING_MODEL`, delete `VECTOR_DB_DIR`, re-run `index`.
- **Expose as API**: import `ask()` into a FastAPI route — `pip install fastapi uvicorn`.
- **PDF support**: `pip install pypdf` (or `pip install -e .[pdf]`).

## Gotchas
- Mixing embeddings from different models in the same Chroma collection returns garbage — always delete `VECTOR_DB_DIR` when changing `EMBEDDING_MODEL`.
- Ollama must be running before `ask` — `ollama serve`, then `ollama pull llama3.1:8b`.
- The Chroma collection is rebuilt from scratch on every `index` run — this is intentional to avoid stale chunks.
