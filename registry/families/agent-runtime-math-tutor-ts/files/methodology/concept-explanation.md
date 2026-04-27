# Concept Explanation Template

## Purpose
Explain a mathematical concept clearly and intuitively.

## Inputs
- **Concept**: e.g., derivative, integral, limit, function
- **Level**: novice, intermediate, advanced
- **Prerequisites**: what the student should already know

## Process
1. Define the concept in simple terms.
2. Provide an intuitive analogy or visual description.
3. Give a formal definition (if appropriate for level).
4. Work through a simple example.
5. Connect to related concepts.
6. Suggest practice problems.

## Output Format
```
:::artifact
template: concept-explanation
## [Concept Name]

### Intuition
[Simple explanation with analogy]

### Formal Definition
[Mathematical definition, if level appropriate]

### Example
[Worked example]

### Related Concepts
- [Concept 1]
- [Concept 2]

### Practice Problems
1. [Problem 1]
2. [Problem 2]
:::
```

## Example
**Concept**: Derivative
**Level**: Novice

### Intuition
The derivative measures how fast something is changing at a specific point. Imagine driving a car: the speedometer shows your instantaneous speed — that's the derivative of your position with respect to time.

### Formal Definition
The derivative of f(x) at x = a is defined as:
f'(a) = lim_{h→0} [f(a+h) - f(a)] / h

### Example
Find the derivative of f(x) = x^2 at x = 3.
Using the limit definition: f'(3) = lim_{h→0} [(3+h)^2 - 9] / h = lim_{h→0} [9 + 6h + h^2 - 9] / h = lim_{h→0} (6 + h) = 6.
So the slope at x=3 is 6.

### Related Concepts
- Slope of a line
- Instantaneous rate of change
- Tangent line

### Practice Problems
1. Find the derivative of f(x) = 2x + 1 at x = 0.
2. Find the derivative of f(x) = x^3 at x = 1.
