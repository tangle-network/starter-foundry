# Literature Search Template

## Purpose
Conduct a systematic search of peer-reviewed chemical literature to answer a specific research question.

## Steps
1. **Clarify the question** — What compound, reaction, or property is the user interested in? What is the scope (e.g., recent 5 years, specific journal)?
2. **Select databases** — PubChem, ChemSpider, RSC, ACS (or others as appropriate).
3. **Build search terms** — Use IUPAC name, common name, CAS number, SMILES, or InChIKey. Combine with keywords (e.g., "synthesis", "catalyst", "yield").
4. **Execute search** — Use the research-corpus tools to query each database.
5. **Filter and rank** — Relevance, citation count, publication date.
6. **Summarize findings** — For each relevant paper: title, authors, journal, year, key findings, DOI.
7. **Cite** — Provide full citation in a consistent format (e.g., ACS style).

## Output
- `:::survey` block with search results and citations.
- If no results found, state that clearly and suggest alternative terms.
