# Meal Planning Template

## Purpose
Design a weekly meal plan that balances nutrition, variety, budget, and cooking effort — and that the user will actually cook on a Wednesday after a hard day.

## When to use
Trigger this template when the user wants a multi-meal, multi-day
plan rather than a single recipe. If the user has a single recipe in
mind, route to `recipe-development.md`.

## Inputs
- Number of cooked meals per week (typically 3–14)
- Household size and per-person appetite
- Dietary preferences and *non-negotiables* (allergies, religious,
  medical — treat as hard constraints)
- Equipment (sheet pan, slow cooker, Instant Pot, sous-vide, grill)
- Skill level and time budget (weeknight ≤30 min, weekend OK longer)
- Budget per week (US$ or local currency) and grocery access
  (warehouse club / supermarket / corner store)
- Preferred cuisines or flavor profiles
- Leftover tolerance (some households cook fresh nightly, some are
  fine with batch-and-rotate)

## Method

1. **List hard constraints first.** Allergies, religious restrictions,
   medical (low-sodium / renal / diabetic), missing equipment. These
   prune the recipe space before any creative work.
2. **Map the week's reality.** Which nights are short on time? Which
   night is the cook-from-scratch one? Are leftovers welcome at lunch
   or only dinner? A plan that ignores Tuesday night's late meeting
   does not get cooked.
3. **Pick a leftover strategy.**
   - **Cook-once-eat-twice**: Sunday roast → Monday salad/soup.
   - **Component prep**: rice + chicken + greens, recombined as
     bowls / wraps / stir-fries through the week.
   - **Theme nights**: taco Tuesday, sheet-pan Wednesday — reduces
     decision load.
4. **Build a protein–vegetable–starch frame** for each meal.
   - Protein: 4–6 oz / 110–170 g per adult portion
   - Vegetable: at least 1 cup / 100–150 g per portion (more = better)
   - Starch or grain: rice, potato, bread, pasta, tortilla — pick by
     cuisine and per-meal energy need
5. **Spread cooking effort.** Mix one or two longer-effort cooks
   (≥45 min, including a make-ahead) with weeknight 20–30-minute
   options. Sundays and Wednesdays are common batch days.
6. **Sequence by perishability.** Plan fresh-fish nights early in
   the week, freezer/pantry meals later. Greens go first; cabbage,
   carrots, root vegetables hold.
7. **Build the shopping list grouped by store layout** (produce,
   dairy, protein, dry goods, frozen) so the user actually executes
   it. Annotate substitutions for items the user might not find.
8. **Estimate budget** by tagging each ingredient with a per-unit
   cost; sum to a per-meal cost. Flag overruns and offer one or two
   swap-in cheaper proteins (chicken thigh for breast, dried beans
   for canned, frozen for fresh seafood out of season).
9. **Plan for the off-script night.** Reserve one weeknight as
   "freezer pizza or omelet" — a plan with zero slack does not
   survive contact with a long workday.

## Output

- Weekly grid (rows = days, columns = meals) with recipe name and
  estimated active cook time.
- Ingredient list grouped by aisle, annotated with quantity.
- Prep timeline: what to do Sunday (batch cook, marinate, soak),
  what to do day-of.
- Leftover trail: which meal becomes which next-day lunch.
- Substitution and budget swaps.

## Common meal-planning failures

1. **Too ambitious.** A plan with 7 from-scratch cooks per week
   collapses by Wednesday. Be honest about effort capacity.
2. **No repeat ingredients.** Buying 14 different produce items for
   one meal each guarantees waste. Repeat strategically.
3. **Allergen-blind.** Dairy, gluten, nuts, soy hide everywhere
   (sauces, broths, spice blends). Read labels in the plan, not in
   the store.
4. **Ignored leftovers.** A plan that doesn't recycle generates
   8+ unique cooks per week and ends in takeout.
5. **No rest day.** Cooking 7 nights is unsustainable; design at
   least one off-script slot.

## Output block

Wrap the deliverable in `:::artifact` with `template: meal-planning`,
include the constraints honored, and flag any user inputs the agent
had to assume (e.g., "assumed 4 portions per dinner; correct me if
different").
