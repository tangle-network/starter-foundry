// Research-corpus tool kit. Wraps four citation sources with a uniform
// {title, authors, year, venue, abstract, doi, url} shape so the agent
// can do axis-by-axis lit-survey work without provider-specific code in
// the system prompt.

export interface Paper {
  title: string
  authors: string[]
  year: number
  venue?: string
  abstract?: string
  doi?: string
  url: string
  citationCount?: number
  source: 'arxiv' | 'semantic-scholar' | 'openalex' | 'crossref'
}

export interface SearchOptions {
  query: string
  yearFrom?: number
  yearTo?: number
  limit?: number
  providers?: Array<'arxiv' | 'semantic-scholar' | 'openalex' | 'crossref'>
}

export async function searchPapers(_opts: SearchOptions): Promise<Paper[]> {
  // Implementation fans out to each enabled provider, dedupes by DOI,
  // ranks by citation count + year recency, returns top `limit`.
  // Each provider call goes through the bundle's sandbox so rate-limit
  // + retry policy is uniform.
  throw new Error('searchPapers: wire arxiv/s2/openalex/crossref clients here, dedupe by DOI')
}

export async function getCitationGraph(_doi: string, _depth = 1): Promise<{
  paper: Paper
  citedBy: Paper[]
  cites: Paper[]
}> {
  throw new Error('getCitationGraph: walk Semantic Scholar citation graph to depth `_depth`')
}

export async function summarizePaper(_paper: Paper, _maxTokens = 200): Promise<string> {
  // Summary goes through router.tangle.tools (see lib/tangle.ts);
  // never call a non-router LLM endpoint from a bundle.
  throw new Error('summarizePaper: chatViaRouter() with a summarization prompt')
}
