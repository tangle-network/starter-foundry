# Citation Analysis Protocol

## Purpose
Analyze the citation network of a given paper or set of papers to understand influence, impact, and research fronts.

## Steps
1. **Identify target paper(s)**: Get the DOI, arxiv ID, or Semantic Scholar ID from the user.
2. **Retrieve citation data**: Use Semantic Scholar's citation graph API to get citing and cited papers.
3. **Compute metrics**:
   - Citation count
   - Citation velocity (citations per year)
   - h-index (if multiple papers)
   - Top citing authors/institutions
4. **Visualize network**: Describe the citation network (e.g., "Paper A is cited by 15 papers, mostly in quantum optics; Paper B is a foundational reference with 200+ citations across condensed matter and quantum information").
5. **Present results**: Emit a `:::survey` block with a summary table and network description.

## Output format
```
:::survey
template: citation-analysis
target: [paper title/ID]

**Citation Metrics**:
- Total citations: ...
- Citations per year: ...
- Top citing fields: ...

**Network Description**:
[2-3 sentence description of the citation landscape]

**Key Citing Papers**:
- [surname, year] Title. Journal.
:::
```

## Refusal
If the paper is not found in any corpus, ask the user to verify the identifier. Do not fabricate citation data.