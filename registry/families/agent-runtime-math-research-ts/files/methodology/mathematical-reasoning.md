# Mathematical Reasoning Template

## Purpose
Explore conjectures, counterexamples, and reasoning chains.

## Steps
1. **State the conjecture**: Clearly define the claim.
2. **Test small cases**: Check for counterexamples in simple instances.
3. **Reason by analogy**: Compare to known results.
4. **Construct a proof or counterexample**: If possible, provide a rigorous argument.
5. **Summarize**: What is known, what is conjectured, what is open.

## Output
- `:::artifact` block with reasoning chain.
- `:::analysis` block for interpretation.

## Example
```
:::artifact template: mathematical-reasoning
## Conjecture: "Every even number greater than 2 is the sum of two primes."
## Small cases: 4=2+2, 6=3+3, 8=3+5, 10=3+7, 12=5+7.
## Status: Open problem (Goldbach's conjecture).
:::
```