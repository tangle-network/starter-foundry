# Generate Exercise Template

## Purpose
Create a practice exercise targeting a specific skill.

## Structure

1. **Skill:** Name the skill (e.g., "implement a binary search tree").
2. **Difficulty:** Beginner / Intermediate / Advanced.
3. **Prompt:** Clear problem statement with input/output examples.
4. **Constraints:** Time/space complexity, language, libraries.
5. **Hints:** Progressive hints (optional, for the tutor to reveal).
6. **Solution:** Full solution with explanation (for the tutor's reference, not to be shown to the learner unless they ask after attempting).

## Example

**Skill:** Implement a function that reverses a linked list.

**Difficulty:** Intermediate

**Prompt:** Write a function `reverse(head)` that takes the head of a singly linked list and returns the new head after reversing the list. Each node has `val` and `next` properties.

**Example:**
Input: 1 -> 2 -> 3 -> null
Output: 3 -> 2 -> 1 -> null

**Constraints:** O(n) time, O(1) space.

**Hints:**
1. Use three pointers: prev, curr, next.
2. Iterate through the list, reversing the `next` pointer of each node.

**Solution:**
```python
def reverse(head):
    prev = None
    curr = head
    while curr:
        next_temp = curr.next
        curr.next = prev
        prev = curr
        curr = next_temp
    return prev
```