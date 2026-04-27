---
capability: sequence-analysis
status: active
source: hand-authored, aligned with NCBI/Ensembl/UniProt accession conventions
retrieved: 2026-04-26
---

# Sequence Analysis methodology

Sequence analysis covers nucleotide and protein sequence retrieval,
annotation lookup, basic comparison (alignment, motif scan, ORF call),
and structure record retrieval. The agent does not run heavy
bioinformatics jobs in-sandbox — it pulls authoritative records, runs
light analysis, and tells the user when a real workflow tool (BLAST+,
HMMER, AlphaFold, IQ-TREE) is required.

## When to use

Trigger this template when the user provides:

- An accession (RefSeq `NM_*`, `NP_*`, `XM_*`; GenBank; UniProt `P*`,
  `Q*`; PDB 4-letter code; Ensembl `ENS*`)
- A raw sequence (FASTA or plain)
- A gene symbol with organism (`TP53` + `Homo sapiens`)
- A pathway / variant / SNP rsID (`rs1801133`)

If the request is purely "tell me about gene X without fetching
anything," chain through `literature-search.md` for the review-level
context, then return here for sequence specifics if needed.

## Method

1. **Echo the input.** Before running anything, restate: "You gave me
   accession `NM_000546.6`, *Homo sapiens*, length 2625 nt — is that
   the record you meant?" Especially for off-by-one accession typos
   (`NM_000546` vs `NM_000546.6` — version matters).
2. **Pick the right database.**
   - mRNA / DNA → NCBI Nucleotide (Entrez `nuccore`), Ensembl
   - Protein → UniProt (canonical for reviewed entries) > NCBI Protein
   - Structure → RCSB PDB; predicted structure → AlphaFold DB (UniProt
     accession indexed)
   - Variant → dbSNP (`rs*`), ClinVar (clinical), gnomAD (population)
   - Expression → GTEx, Expression Atlas, Human Protein Atlas
3. **Pull the record with explicit version.** Sequences and annotations
   evolve. Always include the version suffix (`NM_000546.6`, not bare
   `NM_000546`). Record the pull date in the output.
4. **Run only sandboxed-safe analysis.** OK in-bundle: ORF calling
   on short input, codon-table translation, simple motif regex, GC
   content, length, MW from amino-acid composition. NOT OK in-bundle:
   BLAST against a real DB (use `agent-tools/blast-proxy` if available),
   multi-sequence alignment beyond pairwise of a few hundred residues,
   structural prediction. For NOT-OK: tell the user which workflow tool
   to run and what input shape it needs.
5. **Annotate uncertainty.** Reference vs alternative transcript,
   canonical vs isoform-specific protein, predicted vs validated
   feature, ambiguity codes (`N`, `R`, `Y`, etc.) — call these out.
6. **Output a `:::artifact` block** with template tag, input echo,
   source database + date, and the analysis result.

## Output shape

```
:::artifact
template: sequence-analysis
input: { accession: "NM_000546.6", organism: "Homo sapiens" }
source: { db: "ncbi-nuccore", pulled: "2026-04-26T10:15Z" }
length: 2625
features: [...]
analysis: { gc-content: 0.491, longest-orf-aa: 393, ... }
notes: "Canonical TP53 mRNA. Multiple isoforms exist; this is variant 1."
:::
```

## Common analysis failures

1. **Version-stripped accession.** `NM_000546` matches multiple
   versions over time; analyses run on different versions are not
   comparable. Always pin the version.
2. **Wrong organism.** `BRCA1` alone is ambiguous between human and
   mouse orthologs. Always require organism for gene-symbol queries.
3. **Canonical-vs-isoform conflation.** UniProt canonical is one
   isoform; many genes have biologically meaningful alternative
   isoforms (e.g., Bcl-2 family, Bax-α vs Bax-σ).
4. **Reverse complement silently applied.** When orientation is
   ambiguous (CDS on minus strand), state which strand the analysis
   ran on.
5. **Heavy-job hallucination.** Refuse to "just run BLAST" in the
   sandbox without the tool. Output the exact query string the user
   should paste into NCBI BLAST web or `blastn` CLI.

## Refusal triggers

Refuse and escalate to `:::escalation` when the user requests:

- A real-patient variant interpretation ("my BRCA1 result says…") →
  genetic counselor + clinical lab
- A clinical drug-target prediction tied to a real prescription →
  prescribing clinician
- Help designing primers for a regulated organism (select agents,
  certain pathogens) → biosafety officer
- Sequence-level work on patient-identifying samples (genotype tied to
  PHI) → IRB and HIPAA compliance officer

## Source-of-truth pinning

When the user disputes the agent's output, never paper over with
training-memory recall. Re-pull the record, show the JSON or GenBank
flatfile excerpt, and reconcile. Sequence analysis without the actual
record is rumor.
