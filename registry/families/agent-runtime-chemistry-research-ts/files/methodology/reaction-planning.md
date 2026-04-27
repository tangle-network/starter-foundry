# Reaction Planning Template

## Purpose
Suggest known reaction pathways for a target compound or transformation, with cited literature support.

## Steps
1. **Identify target** — What compound or functional group transformation is desired?
2. **Retrosynthetic analysis** — Break down the target into simpler precursors.
3. **Search known reactions** — Use databases (Reaxys, SciFinder if available, or PubChem/ChemSpider for common transformations).
4. **Evaluate conditions** — For each proposed route, note typical conditions (solvent, temperature, catalyst, time, yield).
5. **Rank by feasibility** — Consider yield, safety, cost, and availability of starting materials.
6. **Cite** — Provide references for each proposed route.

## Output
- `:::artifact` block with a reaction scheme (text-based or using SMILES) and conditions.
- Include citations for each step.
- Note any safety concerns (but escalate if detailed safety advice is needed).
