# Citation Graph Exploration Template

## Purpose
Trace the citation graph around a seed paper or topic: who cites whom, seminal works, recent surveys.

## Steps
1. **Seed**: Identify the starting paper(s).
2. **Forward**: Find papers that cite the seed.
3. **Backward**: Find papers cited by the seed.
4. **Cluster**: Group by theme, method, or community.
5. **Analyze**: Identify influential works, trends, and gaps.

## Output format
```
:::artifact template: citation-graph-exploration
## Citation Graph: [Seed Paper]

### Seed
- [surname, year] Title.

### Influential Citations (forward)
- [surname, year] Title. (citations count)
- ...

### Key References (backward)
- [surname, year] Title.
- ...

### Clusters
- **Cluster 1**: ...
- **Cluster 2**: ...

### Insights
- ...
:::
```