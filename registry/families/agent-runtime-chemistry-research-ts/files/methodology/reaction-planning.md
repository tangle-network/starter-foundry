# Reaction Planning Template

## Purpose
Propose literature-backed synthetic routes to a target compound or
transformation, with conditions, yields, and citations the user can
trace.

## When to use
Trigger when the user asks "how do I make X" or "what reaction
converts A → B" or "is there a known route to <scaffold>". If the
user has not specified the target precisely (functional group,
stereochem, scale), clarify before searching — wrong target produces
wrong literature.

## Inputs
- Target compound (SMILES + IUPAC + CAS if known)
- Required stereochemistry, salt form, scale
- Available starting materials and catalysts
- Constraints: solvent class (no chlorinated), temperature ceiling,
  green-chem preferences, GMP / kilo / lab scale
- Safety envelope (BSL not relevant here, but PPE level and local
  fume-hood class matter)

## Method

1. **Pin the target.** Confirm the structure with SMILES + IUPAC.
   For chiral targets specify the configuration; for prodrugs / salts
   specify the form.
2. **Retrosynthetic analysis.** Apply standard disconnection logic:
   - Look for strategic bonds (C–C, C–N, C=O, ring fusion).
   - Consider polarity-reversal (umpolung) and reductive
     disconnections where useful.
   - Generate 2–4 candidate disconnections; do not over-commit to
     one tree.
3. **Search known reactions** for each disconnection.
   - Reaxys / SciFinder are canonical (paid). Without access:
     Organic Syntheses (free, vetted), ChemRxiv, Crossref + journal
     full-text.
   - For named reactions, `name-reaction.com` or the original
     review article (Fürstner / Hartwig / Buchwald / Doyle reviews
     are common starting points).
4. **Capture per route.** Substrate, reagent, catalyst, solvent,
   temperature, time, atmosphere, scale, reported yield, ee/de
   if chiral, citation. If a route is reported only at small scale,
   flag the scale-up risk.
5. **Rank by feasibility** along the axes:
   - **Yield × selectivity**: weighted product = yield × ee for
     chiral products
   - **Safety**: avoid azides/diazo/peroxides at scale unless
     justified; flag pyrophoric reagents (n-BuLi, NaH in DMF, etc.)
   - **Cost**: starting-material price, catalyst loading
     (precious-metal mol% adds up at scale)
   - **Step count**: fewer linear steps usually wins
   - **Greenness**: solvent (CHEM21 / GSK guide), atom economy,
     E-factor
6. **Show conditions explicitly.** A "Suzuki coupling" without
   ligand, base, solvent, T is not a route — it's a category.
7. **State unknowns.** Stereochem outcome of a named reaction may
   be sensitive to substrate; if literature on the exact substrate is
   thin, say so.

## Output

```
:::artifact
template: reaction-planning
target: { smiles: "...", iupac: "...", cas: "..." }
retrosynthesis:
  - disconnection: "amide bond"
    fragments: ["acid", "amine"]
  - disconnection: "Suzuki C–C"
    fragments: ["aryl boronate", "aryl halide"]
routes:
  - id: "route-A"
    steps:
      - { reagents: "...", solvent: "...", T: "...", time: "...", yield: "82%", source: "DOI:10.xxxx" }
      - ...
    overall-yield: "61% over 3 steps"
    notes: "scale demonstrated to 50 g in source"
  - id: "route-B"
    ...
recommendation: "route-A: shortest, well-established Suzuki–Miyaura conditions, vendor available for both fragments"
:::
```

## Citation discipline

Every step cites a literature source. Refuse to fabricate yields,
ee values, or conditions. If literature lacks a step, propose it as a
hypothesis and tag it as "ungrounded — would need experimental
validation."

## Common planning failures

1. **Catalyst loading dropped.** "Pd(PPh₃)₄ / Suzuki" without mol%
   hides cost; report the actual loading.
2. **Stereochem assumed transferable.** A reaction that's selective
   on substrate-A may be unselective on substrate-B.
3. **Workup omitted.** Many routes succeed in synthesis and fail in
   workup (emulsions, decomposition on silica, hygroscopic
   intermediates). Flag known workup pain.
4. **Missing precedent.** "Should work in principle" with no cited
   example — distinguish proposed from precedented.
5. **Scale-mismatch.** A route that works at 10 mg may fail at
   100 g (heat transfer, mixing, exotherm). Flag scale window.

## Mandatory escalation

Emit a `:::escalation` block immediately if the requested target or
intermediate intersects:

- **DEA-scheduled** controlled substances or their precursors
- **CWC-scheduled** chemicals (Schedule 1/2/3 of the Chemical
  Weapons Convention)
- **Energetic / explosive** materials beyond standard lab quantities
  (azides, peroxides, perchlorates as products / large-scale
  intermediates)
- **Dual-use research** flagged by the user's institution
- Any target the user describes as **for personal pharmacological
  use** rather than research

State the escalation, name the body (institutional security,
licensed pharmacy, DEA registrant, biosafety / chemical-safety
officer), and refuse to provide synthesis detail beyond what's
already in the public literature.
