export const pipeline = {
  name: "rag-retrieval",
  stages: ["ingest", "chunk", "embed", "index", "query", "augment"],

  async ingest(source) {
    console.log(`[rag] ingesting from ${source}`);
    return { chunks: [] };
  },

  async query(question, context) {
    console.log(`[rag] query: ${question}`);
    return { answer: null, sources: [], context };
  },
};
