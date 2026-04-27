# Literature Search Template (chemistry)

## Purpose
Conduct a systematic search of peer-reviewed chemical literature to
answer a specific research question with citation-grounded evidence.

## When to use
Trigger when the user asks for prior art, mechanism evidence, recent
synthesis routes, spectroscopic reference data, or property
measurements for a specific compound, reaction, or class.

## Inputs
- Compound (IUPAC name, common name, CAS, SMILES, InChIKey, or
  SMARTS for class queries)
- Reaction or transformation (substrate → product, optionally with
  named-reaction tag)
- Property of interest (yield, ee, melting point, λmax, NMR shift,
  pKa, log P, crystal structure)
- Time window (recent 5 years is the default; widen for foundational
  questions)
- Required quality (peer-reviewed only / preprints OK)

## Method

1. **Clarify the scope.** What compound, what transformation, what
   condition? "Aldol" alone is too broad — "asymmetric aldol with
   proline organocatalysis on aldehydes ≥C6" is a query.
2. **Pick databases by question type.**
   - Reaction / synthesis route: Reaxys (paid), SciFinder (paid),
     Organic Syntheses (free), open Crossref + arXiv `chem-ph`.
   - Compound property: PubChem (open), ChemSpider, NIST WebBook
     (thermo + spectra), HMDB (metabolites).
   - Crystal structure: CCDC / CSD (some free metadata via WebCSD),
     RCSB PDB for protein-ligand.
   - Spectra: NIST WebBook (IR/MS), SDBS (NMR/IR/MS, free).
   - Citation tracking: Web of Science, Semantic Scholar, OpenAlex.
3. **Build the query.** Boolean (`AND`, `OR`, `NOT`), exact-string
   for IUPAC, structure-search via SMILES/SMARTS where the database
   supports it. CAS number is the single most reliable disambiguator
   when available.
4. **Filter results.** Peer-reviewed first, then preprints
   (ChemRxiv via Crossref) tagged as such. Exclude predatory venues
   when possible (Beall's list lineage / CABELLS).
5. **Capture per-source.** Title, first author, journal, year,
   reaction type / property reported, key result with units, DOI.
   For synthesis routes also capture: scale, solvent, catalyst, yield,
   ee/de.
6. **Synthesize.** A 2–4 sentence summary naming the consensus route /
   value, the contested ones, and the data gap the user might need
   to fill.

## Output

Wrap in `:::survey`:

```
:::survey
template: literature-search
query: "..."
query-date: <YYYY-MM-DD>
corpora: [pubchem, scifinder-or-reaxys, openalex]

[surname, year]: <one-line contribution> [DOI:10.xxxx]
...

Synthesis: ...
:::
```

## Citation discipline

Every claim ships with a citation. Refuse to fabricate compound
properties, NMR shifts, yields, or conditions. If a value is not in
the literature, say so and suggest the experiment (DFT, measurement)
that would generate it.

## Common search-quality failures

1. **CAS-blind search.** "Aspirin" alone returns ambiguous hits;
   `CAS 50-78-2` is unambiguous.
2. **Single-database tunnel.** Synthesis databases (Reaxys/SciFinder)
   miss methodology papers indexed only in Crossref / OpenAlex.
3. **Stereochemistry stripped.** A SMILES without `@` / `@@` matches
   any stereoisomer; downstream synthesis decisions will be wrong.
4. **Salt-form ignored.** Drug literature reports ratios on
   different salt forms (HCl, mesylate, free base); conversion
   matters.
5. **Predatory-journal contamination.** Some journals report
   yields and ee values that don't replicate. Tag any non-indexed
   journal as "unverified peer review" in the survey.

## Refusal triggers

Refuse and emit `:::escalation` when the user asks for:
- Synthesis routes for **DEA-scheduled, NIPC, or dual-use chemicals**
  (precursors to weapons, controlled drugs, energetics) — escalate
  to the user's institutional security / DEA registrant.
- **Pharmaceutical formulation advice** for a real patient — escalate
  to a clinical pharmacist.
- Bypassing journal paywalls — refuse; suggest interlibrary loan or
  the author's preprint.
