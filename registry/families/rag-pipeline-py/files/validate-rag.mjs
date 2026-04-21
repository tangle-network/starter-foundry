import fs from "node:fs/promises";

const [pyproject, pipeline, envExample, sampleDoc] = await Promise.all([
  fs.readFile("pyproject.toml", "utf8"),
  fs.readFile("src/pipeline.py", "utf8"),
  fs.readFile(".env.example", "utf8"),
  fs.readFile("docs/sample.md", "utf8"),
]);

for (const dep of ["langchain-core", "langchain-community", "chromadb", "sentence-transformers", "httpx"]) {
  if (!pyproject.includes(dep)) {
    throw new Error(`pyproject.toml missing ${dep}`);
  }
}

for (const token of ["chromadb", "SentenceTransformer", "def index", "def ask", "LLM_BASE_URL"]) {
  if (!pipeline.includes(token)) {
    throw new Error(`src/pipeline.py missing ${token}`);
  }
}
if (!pipeline.includes("RecursiveCharacterTextSplitter") && !pipeline.includes("CharacterTextSplitter")) {
  throw new Error("src/pipeline.py missing a langchain text splitter");
}
if (!pipeline.includes("cosine") && !pipeline.includes("similarity_search")) {
  throw new Error("src/pipeline.py must perform similarity search against Chroma");
}

for (const key of ["LLM_BASE_URL", "LLM_MODEL", "EMBEDDING_MODEL", "VECTOR_DB_DIR"]) {
  if (!envExample.includes(key)) {
    throw new Error(`.env.example missing ${key}`);
  }
}

if (sampleDoc.trim().length < 20) {
  throw new Error("docs/sample.md must contain real placeholder content");
}

console.log("rag pipeline starter ok");
