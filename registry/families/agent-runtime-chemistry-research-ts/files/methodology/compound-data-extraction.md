# Compound Data Extraction Template

## Purpose
Retrieve structured physicochemical, spectral, and hazard data for a given compound from authoritative databases.

## Steps
1. **Identify compound** — Use name, CAS, SMILES, or InChI.
2. **Query databases** — PubChem (primary), ChemSpider, and others as needed.
3. **Extract fields** — Molecular formula, molecular weight, logP, pKa, melting/boiling point, density, solubility, spectral data (NMR, IR, MS), hazard codes (GHS), and any known safety classifications.
4. **Validate** — Cross-reference multiple sources if possible.
5. **Present** — Tabulate the data in a clear format.
6. **Cite** — Provide source URLs or DOIs for each data point.

## Output
- `:::artifact` block with a data table.
- If data is missing, note that and suggest alternative sources.
- Do not interpret hazard data beyond what the source states; escalate if the user asks for safety advice.
