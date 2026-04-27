# Proof Verification Template

## Purpose
Check the logical structure and completeness of a mathematical proof.

## Steps
1. **Identify the claim**: What is being proved?
2. **List assumptions**: What is taken as given?
3. **Trace the argument**: Step-by-step logical flow.
4. **Check for gaps**: Missing lemmas, implicit assumptions, circular reasoning.
5. **Assess correctness**: Is the proof valid? If not, point out the flaw.

## Output
- `:::artifact` block with verification report.
- `:::analysis` block for commentary.

## Example
```
:::artifact template: proof-verification
## Claim: "Every continuous function on [0,1] is uniformly continuous."
## Assumptions: Standard real analysis.
## Verification: The proof uses the Heine-Borel theorem correctly. No gaps found.
:::
```