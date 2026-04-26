# Vocabulary drill

Spaced-repetition vocabulary practice. The methodology is borrowed
directly from Anki / SuperMemo: review intervals expand on success
and reset on failure, words live in **contextual sentences** (not
isolated lists), and recognition vs production are scheduled
asymmetrically. The drill produces a `:::artifact` flashcard pack
the host UI can route into the learner's SRS queue.

## When this fires

Triggered on demand ("drill me on this week's words"), and pulled
into daily-conversation sessions when the daily-cron flow tags new
words for SRS.

## Anki-style interval ladder

Each card has a state. On a successful recall, advance to the next
interval. On a failure, reset to **1 day** and re-enter the ladder.

| State | Next review |
|-------|-------------|
| New | 1 day |
| Young #1 | 3 days |
| Young #2 | 7 days |
| Maturing | 14 days |
| Mature | 30 days |
| Established | 90 days |
| Learned | retire from active queue |

A card is considered **learned** after two consecutive successful
recalls at the 90-day interval. Drop it from the active queue at
that point and surface it only if the learner appears to have
forgotten it in conversation.

## Card composition rules

Every card is built from a contextual sentence, not a bare word.

- **Front (recognition card):** a sentence in the target language
  with the target word visible. Learner reads + says aloud + gives
  the meaning in their L1 (or a target-language paraphrase, for
  C1+).
- **Front (production card):** the same sentence with the target
  word *cloze-deleted* (e.g. `Yo siempre ___ café por la mañana`).
  Learner produces the missing word.
- **Back:** the full sentence + a brief gloss + 1 collocation /
  example of the same word in another sentence.

Production cards are harder than recognition cards. Schedule them
**one ladder-step behind** the recognition card for the same word —
this respects the recognition-vs-production asymmetry: learners
recognize words long before they can produce them, and forcing
production too early raises the affective filter and slows
acquisition.

## Card selection — three valid clustering strategies

Different learners learn from different cluster shapes. Pick one
per drill pack; do not mix.

1. **Frequency-based** — top-N most-frequent words the learner
   does not yet recognize. Best for early A1 / A2 learners
   building comprehension density. Source: a frequency dictionary
   for the target language.
2. **Semantic clustering** — 5–8 words that share a domain ("the
   kitchen", "argument and disagreement", "being late"). Helps
   with retrieval because the brain stores related words on
   adjacent hooks. Best for B1+ once the high-frequency core is
   in place.
3. **Theme-based / personal** — words pulled from the learner's
   own conversations and reading. Highest acquisition rate
   because relevance is maximal, but only works if the learner
   has been generating real input.

Pick the strategy that matches the learner's level + recent
session content. Note which strategy was used in the
`:::artifact`.

## Drill session flow

1. **Warm-up (1 min).** Surface 3 cards already in the *Mature*
   state for a quick win. Builds momentum; mature cards almost
   always succeed.
2. **Active drill (5–8 min).** 8–12 cards from *New* / *Young* /
   *Maturing*. Mix recognition and production roughly 60/40.
3. **Failure handling.** On a missed card, **do not** punish.
   Show the answer in context, ask the learner to use it in a
   new sentence (production reinforcement), reset the card to
   1-day interval.
4. **Wrap (1 min).** Persist the updated SRS state as a
   `:::artifact` so the host UI can re-queue tomorrow's review
   set.

## When to drop a word as "learned"

A word is **learned** when it meets all of:

- Two consecutive successful recalls at the 90-day interval.
- The learner has produced it spontaneously (not in a drill) at
  least once.
- It has not appeared as a recast target in the last 4 daily
  conversations.

Words that pass these gates are retired from the active SRS queue.
They may surface again if the learner stumbles on them in
conversation — re-add at the 7-day interval rather than starting
over.

## What to skip

- Do not generate 30-word vocab lists. The drill cap is 12 active
  cards; more than that and recall accuracy collapses.
- Do not show a word without its sentence context. Context is the
  acquisition primitive.
- Do not include grammar-drill items dressed up as vocab cards
  (verb conjugation tables, declension paradigms). That's a
  different methodology and not one this bundle ships.
- Do not auto-translate the back of cards into the learner's L1
  for B1+ learners — a target-language paraphrase produces deeper
  encoding.
