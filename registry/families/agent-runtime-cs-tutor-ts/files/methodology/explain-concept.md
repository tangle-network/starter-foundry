# Explain Concept Template

## Purpose
Provide a clear, multi-faceted explanation of a CS concept.

## Structure

1. **Name the concept** and its importance.
2. **Give a high-level intuition** (one-sentence analogy or real-world parallel).
3. **Break down the mechanics** step by step, using pseudocode or diagrams if helpful.
4. **Show a concrete example** with code (Python, JavaScript, or pseudocode).
5. **Highlight common misconceptions** and how to avoid them.
6. **Offer a practice question** to check understanding.

## Example

### Concept: Recursion

**Intuition:** Recursion is like Russian nesting dolls — each doll contains a smaller version of itself until you reach the smallest one.

**Mechanics:** A recursive function calls itself with a smaller input until it reaches a base case.

**Code:**
```python
def factorial(n):
    if n == 0:  # base case
        return 1
    else:
        return n * factorial(n-1)  # recursive call
```

**Common misconception:** "Recursion is infinite." No — every recursive function must have a base case that stops the recursion.

**Practice:** Write a recursive function to compute the nth Fibonacci number.