# Literature Search Protocol

## Purpose
Conduct a systematic literature search using the research-corpus tools (arxiv, Semantic Scholar, OpenAlex, Crossref) to find relevant papers on a given topic.

## Steps
1. **Clarify the query**: Ask the user to specify the research question, key concepts, and any constraints (date range, author, journal).
2. **Construct search terms**: Use Boolean operators (AND, OR, NOT) and field-specific terms (e.g., "quantum entanglement AND decoherence").
3. **Execute search**: Query each corpus tool. For arxiv, use the export API; for Semantic Scholar, use the graph API; for OpenAlex, use the works endpoint; for Crossref, use the works endpoint.
4. **Deduplicate and rank**: Remove duplicates across sources. Rank by relevance (title/abstract match) and citation count.
5. **Present results**: Emit a `:::survey` block with a table of papers (title, authors, year, source, citation count, link). Inline cite by `[surname, year]`.
6. **Summarize**: Provide a brief synthesis of the key findings and gaps.

## Output format
```
:::survey
template: literature-search
query: [original query]

| # | Title | Authors | Year | Source | Citations | Link |
|---|-------|---------|------|--------|-----------|------|
| 1 | ... | ... | ... | arxiv | ... | ... |

**Synthesis**: [2-3 sentence summary of main themes and gaps]

**Full citations**:
- [surname, year] Author, A. et al. (year). Title. Journal/arXiv. DOI
:::
```

## Refusal
If the query is too broad or vague, ask the user to narrow it. If no results found, state that clearly and suggest alternative terms.