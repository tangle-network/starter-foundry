# Problem Generation Template

## Purpose
Generate practice problems tailored to the student's level and topic.

## Inputs
- **Topic**: e.g., derivatives, integrals, limits, algebra equations
- **Level**: novice, intermediate, advanced
- **Number of problems**: default 3
- **Style**: multiple-choice, free-response, or mixed

## Process
1. Identify the core skill being practiced.
2. Generate problems that increase in difficulty.
3. Provide answer key with step-by-step solutions (separate from student-facing problems).
4. Include hints for each problem (optional, for scaffolding).

## Output Format
```
:::artifact
template: problem-generation
## Problem Set: [Topic]

1. [Problem 1]
2. [Problem 2]
3. [Problem 3]

---
### Answer Key
1. [Solution 1]
2. [Solution 2]
3. [Solution 3]
:::
```

## Example
**Topic**: Derivatives (power rule)
**Level**: Novice

1. Find the derivative of f(x) = 3x^4.
2. Find the derivative of f(x) = 5x^2 + 2x - 7.
3. Find the derivative of f(x) = x^3 - 4x^2 + 6x - 1.

**Hints**:
1. Use the power rule: d/dx [x^n] = n x^(n-1).
2. Differentiate term by term.
3. Same as hint 2.
