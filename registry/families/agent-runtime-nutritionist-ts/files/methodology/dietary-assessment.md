# Dietary Assessment Template

## Purpose
Evaluate a user's current dietary intake against evidence-based
guidelines, identify the highest-leverage gaps, and produce
realistic recommendations the user will actually follow. Advisory
only — never replaces a registered dietitian (RD/RDN) for
medical-nutrition therapy.

## When to use
Trigger when the user shares a food log, asks "is my diet okay,"
or wants to know what to change. For specific macro targets, use
macro-targets.md. For meal planning, use meal-plan.md.

## Inputs
- 24-hour recall *or* 3–7 day food log (more days = more
  accurate; one day is anecdote).
- Goals: weight management, performance, lab markers, condition
  management, energy.
- Conditions known: diabetes, CKD, GI disorders, food allergies,
  pregnancy, eating-disorder history.
- Lifestyle: activity level, sleep, alcohol, schedule
  constraints.
- Cultural / religious / ethical context that shapes food choice.

## Method

1. **Estimate intake.** From the recall or log:
   - Total energy (kcal/day, with 7-day average if available).
   - Protein, carb, fat in grams and as % of energy.
   - Fiber (g).
   - Saturated fat, sodium, added sugar.
   - Estimated micronutrients of interest (calcium, iron,
     B12, vitamin D, folate, magnesium, potassium, omega-3) —
     order-of-magnitude only; precise micronutrient analysis
     requires a tool.
2. **Compare against AMDRs and DRIs.**
   - **AMDR** (Acceptable Macronutrient Distribution Range):
     protein 10–35%, carb 45–65%, fat 20–35% of total energy.
   - **DRI** (Dietary Reference Intake) for individual
     micronutrients by age / sex.
   - **Fiber**: 25 g/day for women, 38 g/day for men (~14 g
     per 1000 kcal).
   - **Saturated fat**: <10% of energy.
   - **Sodium**: <2300 mg/day for general population.
   - **Added sugar**: <10% of energy (AHA: <6% for women,
     <9% for men).
3. **Pattern check.** Look for the typical patterns rather than
   nutrient-by-nutrient:
   - Low vegetable / fruit intake (most common gap).
   - Insufficient protein at breakfast.
   - Skipped meals → late-day overeating.
   - High ultra-processed-food share (UPF; correlates with
     poor outcomes independent of macro composition).
   - Alcohol displacing food.
   - Frequent sugary drinks.
   - Imbalance: e.g., high meat / low plant; high refined
     carb / low fiber.
4. **Compare to a credible eating pattern.** Rather than
   nitpicking nutrients, check fit against:
   - **Dietary Guidelines for Americans** (DGA): half plate
     fruits/veg, lean protein, whole grain.
   - **Mediterranean** pattern: olive oil, fish, legumes,
     whole grain, nuts, vegetables.
   - **DASH** (for hypertension): low sodium, high potassium,
     vegetable-forward.
   - **Plate method** (diabetes): ½ non-starchy veg, ¼ protein,
     ¼ carb.
5. **Prioritize changes.** Rank by:
   - **Impact** on the user's stated goal.
   - **Feasibility** given their schedule, budget, and
     preferences.
   - **Adherence likelihood**: small specific changes beat
     dramatic overhauls (one new vegetable per dinner > "eat
     Mediterranean").
   Cap recommendations at **3** for the first session — more
   produces fewer changes adopted.
6. **Strength-based delivery.**
   - Lead with what the user is already doing well.
   - Frame changes as additions where possible ("add a serving
     of legumes" is easier than "cut red meat").
   - Don't moralize.
7. **Lab and condition flags.**
   - If the user shares labs (lipids, A1c, ferritin, B12,
     vitamin D, eGFR), incorporate but flag that interpretation
     is the clinician's.
   - If conditions warrant medical-nutrition therapy
     (diagnosed CKD, T1D, IBD, eating disorder), refuse
     prescriptive advice and refer to RD.

## Common assessment failures

1. **Snapshot-from-one-day.** A 24-hour recall has high
   variance; treat as a starting point, not a verdict.
2. **Numbers without pattern.** "High sodium" missed; the user
   has a high-canned-soup habit. Pattern reveals the lever.
3. **Overhaul advice.** "Switch to Mediterranean" — collapses
   in 2 weeks. Smaller adjacent changes stick.
4. **Diagnosing deficiency from diet.** Diet predicts risk, not
   status. Refer for labs if in doubt.
5. **Ignoring culture / budget / access.** Recommendations the
   user can't execute are worse than no recommendation.
6. **Toxic-positivity reframing.** Pretending "any food is
   fine" when the user has a measurable issue.
7. **Diagnostic framing for eating disorders.** Calorie-counting
   prescriptions can harm someone with restrictive-ED history.
   Screen lightly before prescribing.

## Output

```
:::artifact
template: dietary-assessment
intake-estimate:
  kcal: ...
  protein-g: ...
  carb-g: ...
  fat-g: ...
  fiber-g: ...
  saturated-fat-pct: ...
  sodium-mg: ...
  added-sugar-pct: ...
pattern-flags:
  - "low vegetable intake (~1.5 servings/day vs 2.5–4 recommended)"
  - "protein concentrated at dinner; <10g at breakfast"
strengths:
  - "consistent meal timing"
  - "good fish 2×/week"
recommendations:
  - { rank: 1, action: "add a vegetable serving to lunch", rationale: "biggest gap; low effort" }
  - { rank: 2, action: "add 20g protein to breakfast (yogurt or eggs)", rationale: "supports satiety and energy" }
  - { rank: 3, action: "swap sweetened soda for sparkling water 4 days/week", rationale: "removes added sugar load" }
labs-flagged: []
follow-up: "re-assess in 4 weeks"
:::
```

## Refusal triggers

The agent will:
- **Refuse** to diagnose a deficiency from diet alone — refer
  to clinician for labs.
- **Refuse** to provide medical-nutrition therapy for
  diagnosed conditions (CKD, T1D, IBD, oncology, eating
  disorders) — refer to RD.
- **Refuse** to prescribe extreme restriction (very-low-calorie
  diets, prolonged fasting) — these require clinical
  supervision.
- **Escalate** to a behavioral / eating-disorder professional
  if the user describes restrictive, binge, purge, or
  obsessive food behavior; surface NEDA helpline (US:
  1-800-931-2237).
- **Escalate** to clinician if user shares concerning labs.
