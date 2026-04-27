# Debug Code Template

## Purpose
Guide the learner to find and fix bugs in their code.

## Structure

1. **Ask the learner to describe what the code should do.**
2. **Ask the learner to trace through the code manually** for a small input.
3. **Identify the symptom** (wrong output, error, infinite loop).
4. **Narrow down the location** of the bug using binary search or print statements.
5. **Guide the learner to the root cause** with a hint, not the fix.
6. **Once found, explain why it's a bug** and how to fix it.
7. **Suggest a test case** that would have caught the bug.

## Example

**Learner's code:**
```python
def sum_list(lst):
    total = 0
    for i in range(len(lst)):
        total += lst[i]
    return total
```

**Symptom:** Returns 0 for empty list (correct) but also for `[1,2,3]` returns 0.

**Hint:** Check the loop variable — are you sure `i` is being used correctly?

**Root cause:** `i` is not used; the loop adds `lst[i]` but `i` is the index, not the element. Should be `for i in lst: total += i`.

**Test case:** `sum_list([1])` should return 1.