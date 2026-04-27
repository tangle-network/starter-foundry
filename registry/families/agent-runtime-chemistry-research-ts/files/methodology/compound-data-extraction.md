# Compound Data Extraction Template

## Purpose
Pull a well-formed property record for a specific compound — physical
constants, spectroscopic data, regulatory status, hazard data — from
authoritative databases, with citation and pull date.

## When to use
Trigger when the user gives a compound identifier (IUPAC, common
name, CAS, SMILES, InChIKey) and asks for properties, spectra, hazard
class, or regulatory status. If the user asks for "everything known
about X" without a specific question, propose a property profile and
confirm before pulling.

## Inputs
- Compound identifier (CAS preferred for unambiguity)
- Properties of interest:
  - Physical: MW, mp, bp, density, solubility, log P
  - Spectroscopic: λmax (UV-Vis), NMR (¹H, ¹³C, ³¹P, ¹⁹F), IR, MS
  - Thermo: ΔHf, S°, Cp
  - Regulatory: GHS hazard class, REACH status, schedule status
  - Biological: ADMET, target binding, metabolic pathway

## Method

1. **Echo the input.** Restate the compound identifier and confirm
   protonation state, salt form, and stereochemistry. Never silently
   strip stereo or assume neutral form.
2. **Pick the canonical source per property.**
   - MW, formula, identifier interconversion: PubChem
   - Thermo: NIST WebBook
   - Spectra: NIST WebBook (IR, MS), SDBS (NMR, IR, MS), HMDB
     (biological compounds)
   - Hazard: ECHA (REACH), GESTIS, SDS from manufacturer
   - Regulatory: DEA / Health Canada / national equivalent for
     scheduled compounds
   - Biological: ChEMBL, DrugBank, KEGG
3. **Pull and pin.** Record the database, the accession (CID, CAS,
   ChEMBL ID), the property value with units, and the pull date.
   Property records update.
4. **Sanity-check across sources.** When two databases disagree on a
   physical constant, surface the discrepancy and prefer the
   peer-reviewed primary source. Common conflicts: log P (cLogP from
   different algorithms varies by 0.5–1.0 units), pKa
   (computed vs measured), solubility (vehicle-dependent).
5. **Convert units explicitly.** Don't silently translate kJ/mol →
   kcal/mol — show the conversion.
6. **Distinguish measured from computed.** Report measured values
   first; flag DFT / QSAR predictions as such.

## Output

```
:::artifact
template: compound-data-extraction
compound:
  iupac: "..."
  cas: "..."
  smiles: "..."
  inchi-key: "..."
  salt-form: "free base" | "HCl" | ...
  stereochem: "racemic" | "(S)" | ...
properties:
  - { name: "MW", value: 180.16, unit: "g/mol", source: "PubChem CID 2244", pulled: "2026-04-26" }
  - { name: "logP", value: 1.19, unit: "(none)", source: "DrugBank DB00945, measured", pulled: "..." }
  - { name: "pKa", values: [3.49], unit: "(none)", source: "Avdeef 2003", pulled: "..." }
spectra:
  - { kind: "1H NMR", solvent: "DMSO-d6", source: "SDBS-NMR-NSDB-1234", url: "..." }
hazard:
  ghs: ["H315", "H319"]
  pictograms: ["GHS07"]
  source: "ECHA, REACH dossier"
:::
```

## Citation discipline

Every value ships with a source. Refuse to fabricate spectra
(chemical shifts, mass-spec fragments) — direct the user to the
canonical database or to a measurement. If the database doesn't have
it, flag the gap.

## Common extraction failures

1. **Salt-form drift.** PubChem often defaults to free base;
   many drug literature reports refer to the HCl / mesylate / etc.
   Convert MW or yield with explicit salt-form math.
2. **Stereochem stripped.** Connection-only structure searches lose
   chirality; for chiral drugs / catalysts this is a critical error.
3. **Solvent-dependent values reported context-free.** NMR shifts
   in CDCl₃ vs DMSO-d₆ vs D₂O differ. State solvent.
4. **Predicted ≠ measured.** XLogP, cLogP, EPI-Suite values are
   useful but not measurements. Tag predicted values.
5. **Outdated regulatory status.** DEA scheduling, REACH lists
   change. Always include pull date.

## Refusal triggers

Refuse and emit `:::escalation` when the user asks for compound data
that materially supports:
- Synthesis of scheduled controlled substances or weapons-relevant
  precursors → institutional security
- Real-patient pharmacotherapy decisions (dose, drug interaction
  beyond literature reporting) → clinical pharmacist
