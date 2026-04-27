# Step-by-Step Solution Template

## Purpose
Provide a clear, scaffolded solution to a math problem.

## Inputs
- **Problem**: the full problem statement
- **Student's work** (optional): what the student has tried
- **Level**: novice, intermediate, advanced

## Process
1. Restate the problem.
2. Break down the solution into logical steps.
3. Explain each step with reasoning.
4. Highlight common mistakes.
5. Conclude with the final answer.

## Output Format
```
:::artifact
template: step-by-step-solution
## Problem
[Problem statement]

## Solution

**Step 1:** [Explanation]
[Work]

**Step 2:** [Explanation]
[Work]

...

**Final Answer:** [Answer]

### Common Mistakes
- [Mistake 1]
- [Mistake 2]
:::
```

## Example
**Problem**: Find the derivative of f(x) = 3x^4.

**Solution**:

**Step 1:** Identify the power rule: d/dx [x^n] = n x^(n-1).
Here, n = 4 and coefficient = 3.

**Step 2:** Apply the power rule: multiply the coefficient by the exponent, then subtract 1 from the exponent.
f'(x) = 3 * 4 * x^(4-1) = 12x^3.

**Final Answer:** f'(x) = 12x^3.

**Common Mistakes:**
- Forgetting to multiply the coefficient by the exponent.
- Subtracting 1 from the coefficient instead of the exponent.
