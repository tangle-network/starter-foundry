# Literature Review Template

## Purpose
Systematically search and summarize mathematical literature on a given topic.

## Steps
1. **Define the query**: Identify key terms, authors, and time range.
2. **Search sources**: Use arxiv, Semantic Scholar, OpenAlex, Crossref.
3. **Filter results**: Relevance, citation count, venue.
4. **Summarize**: For each paper, note the main result, method, and relation to the query.
5. **Synthesize**: Identify trends, gaps, and open problems.

## Output
- `:::artifact` block with structured summary.
- `:::survey` block with citations.

## Example
```
:::artifact template: literature-review
## Query: "Quantum error correction with topological codes"
### Papers
1. **Kitaev, 2003** - Toric code, anyon braiding.
2. **Bombin & Martin-Delgado, 2006** - Color codes.
### Synthesis
Topological codes offer high thresholds but require 2D connectivity.
:::
```