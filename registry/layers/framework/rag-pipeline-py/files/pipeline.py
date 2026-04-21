"""End-to-end RAG pipeline.

Usage:
    python -m src.pipeline index            # (re)build the Chroma collection
    python -m src.pipeline ask "question"   # retrieve + answer

Swap the LLM by pointing LLM_BASE_URL at any OpenAI-compatible server
(Ollama's /api/chat is auto-detected from the base URL).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Iterable

import httpx
from dotenv import load_dotenv

# langchain-text-splitters is re-exported from langchain-community in older
# pins; import the modern path first.
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:  # pragma: no cover — fallback for older installs
    from langchain.text_splitter import RecursiveCharacterTextSplitter  # type: ignore

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

load_dotenv()

DOCS_DIR = Path(os.environ.get("DOCS_DIR", "./docs"))
VECTOR_DB_DIR = Path(os.environ.get("VECTOR_DB_DIR", "./chroma_db"))
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.environ.get("LLM_MODEL", "llama3.1:8b")
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "120"))
TOP_K = int(os.environ.get("TOP_K", "4"))

COLLECTION_NAME = os.environ.get("COLLECTION_NAME", "rag-docs")


def _load_docs(root: Path) -> list[tuple[str, str]]:
    """Return (source_path, text) pairs for every supported file under root."""
    results: list[tuple[str, str]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        suffix = path.suffix.lower()
        if suffix in {".md", ".txt"}:
            results.append((str(path), path.read_text(encoding="utf-8")))
        elif suffix == ".pdf":
            try:
                from pypdf import PdfReader  # lazy — only needed if PDFs exist
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError(
                    "PDF ingest requires `pip install pypdf` (or `pip install -e .[pdf]`)."
                ) from exc
            text = "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
            results.append((str(path), text))
    return results


def _chunk(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


def _embedder() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL)


def _client() -> chromadb.PersistentClient:
    VECTOR_DB_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(
        path=str(VECTOR_DB_DIR),
        settings=Settings(anonymized_telemetry=False, allow_reset=True),
    )


def index() -> int:
    """Ingest DOCS_DIR into Chroma. Rebuilds the collection from scratch."""
    if not DOCS_DIR.exists():
        print(f"DOCS_DIR {DOCS_DIR} does not exist", file=sys.stderr)
        return 1
    docs = _load_docs(DOCS_DIR)
    if not docs:
        print(f"No ingestible docs under {DOCS_DIR}", file=sys.stderr)
        return 1

    embedder = _embedder()
    client = _client()
    # Idempotent: delete + recreate so re-indexing never mixes stale chunks.
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    chunks: list[str] = []
    metadatas: list[dict[str, str]] = []
    ids: list[str] = []
    for source, text in docs:
        for i, chunk in enumerate(_chunk(text)):
            chunk_id = f"{source}::{i}"
            chunks.append(chunk)
            metadatas.append({"source": source, "chunk": str(i)})
            ids.append(chunk_id)

    vectors = embedder.encode(chunks, batch_size=32, show_progress_bar=False).tolist()
    collection.add(documents=chunks, embeddings=vectors, metadatas=metadatas, ids=ids)
    print(f"Indexed {len(chunks)} chunks from {len(docs)} docs into {VECTOR_DB_DIR}")
    return 0


def retrieve(query: str, k: int = TOP_K) -> list[tuple[str, str, float]]:
    """Return (chunk_text, source, cosine_distance) for the top-k matches."""
    embedder = _embedder()
    collection = _client().get_collection(COLLECTION_NAME)
    query_vec = embedder.encode([query]).tolist()
    # similarity_search — Chroma reports distance (lower is better for cosine).
    result = collection.query(query_embeddings=query_vec, n_results=k)
    docs = result["documents"][0]
    metas = result["metadatas"][0]
    dists = result["distances"][0]
    return [
        (str(d or ""), str((m or {}).get("source", "?")), float(dist))
        for d, m, dist in zip(docs, metas, dists)
    ]


def _llm_chat(system: str, user: str) -> str:
    """Call the configured LLM. Auto-detect Ollama vs OpenAI-compatible."""
    is_ollama = "11434" in LLM_BASE_URL or LLM_BASE_URL.rstrip("/").endswith("/api")
    if is_ollama:
        url = LLM_BASE_URL.rstrip("/") + "/api/chat"
        payload = {
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
        }
        with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()
        return body["message"]["content"]

    # OpenAI-compatible fallback.
    url = LLM_BASE_URL.rstrip("/") + "/v1/chat/completions"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {}
    api_key = os.environ.get("LLM_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        response = client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()
    return body["choices"][0]["message"]["content"]


def ask(question: str) -> str:
    """Retrieve top-k chunks and synthesize an answer with inline citations."""
    hits = retrieve(question)
    if not hits:
        return "No documents indexed. Run `python -m src.pipeline index` first."
    context_blocks: list[str] = []
    for chunk, source, _distance in hits:
        context_blocks.append(f"[doc:{Path(source).name}]\n{chunk}")
    context = "\n\n---\n\n".join(context_blocks)
    system = (
        "You answer questions using ONLY the provided context. "
        "Cite every claim with the [doc:filename] marker from the matching "
        "passage. If the context does not contain the answer, say so plainly."
    )
    user = f"Context:\n{context}\n\nQuestion: {question}"
    return _llm_chat(system, user)


def _usage() -> int:
    print("usage: python -m src.pipeline {index | ask <question>}", file=sys.stderr)
    return 2


def main(argv: Iterable[str]) -> int:
    args = list(argv)
    if not args:
        return _usage()
    cmd, *rest = args
    if cmd == "index":
        return index()
    if cmd == "ask":
        if not rest:
            return _usage()
        print(ask(" ".join(rest)))
        return 0
    return _usage()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
