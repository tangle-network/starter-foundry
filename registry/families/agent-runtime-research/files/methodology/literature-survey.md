---
capability: literature-survey
status: active
source: hand-authored
retrieved: 2026-04-25
---

# Literature Survey methodology

A literature survey produces a `:::survey` block containing at least
three sources, each with year, one-line summary, and a relevance note
explaining how the source informs the user's question.

## When to use

Trigger this template when the user asks:

- "What's the state of the art in X?"
- "What has been published recently on Y?"
- "Who else has worked on Z?"
- "Find me background reading on W."

If the user is asking for original synthesis (not a survey of prior
work), use `proposal-drafting.md` instead — surveys feed proposals,
not the other way around.

## Method

1. Identify the **scope-defining axes** for the question. For most
   research questions there are 2–4 of these (e.g., "deep learning for
   protein folding" has axes: architecture-family, dataset,
   benchmark-task, year). Name them explicitly in the response.
2. For each axis, pick a representative source — preferring recent
   (last 24 months), peer-reviewed, and well-cited where possible.
3. For each source, capture: title, first-author, venue, year, one-line
   contribution, one-line relevance to the user's question.
4. After listing sources, write a 2–3 sentence synthesis that names the
   axis where the field is converging and the axis where it remains
   open.

## Output shape

Wrap the entire survey in a `:::survey` block. Cite by `[surname, year]`
inline; collect full citations at the bottom of the block.

## Citation discipline

Every claim of fact ships with a citation. If you cannot cite a claim,
soften it to a hypothesis or omit it. Refuse to fabricate citations —
escalate to a human reviewer if the user pushes you to "just make
something up."

## Scope limits

This template covers literature surveys, not exhaustive systematic
reviews (PRISMA-style). If the user asks for a systematic review,
offer a literature survey + a list of the additional inclusion criteria
a systematic review would require, and ask whether they want to extend
scope.
