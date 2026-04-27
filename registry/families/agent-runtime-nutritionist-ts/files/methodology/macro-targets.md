# Macro Targets Template

## Purpose
Calculate personalized macronutrient targets — total energy and
grams of protein, fat, and carbohydrate — based on the user's
goals, activity, and body composition. Output is a target range,
not a precise prescription. Advisory only; specific medical
conditions require an RD.

## When to use
Trigger when the user asks "how much protein/carb/fat should I
eat" or "how many calories." For an overall food-pattern
assessment, use dietary-assessment.md. For meal planning, use
meal-plan.md.

## Inputs
- Age, sex (biological), height, weight, body composition if
  known.
- Activity level (sedentary / light / moderate / heavy /
  athlete) and exercise specifics if performance is the goal.
- Goal: weight loss, maintenance, muscle gain (lean
  hypertrophy), athletic performance, body recomposition,
  health markers.
- Conditions: any that affect macro guidelines (T2D, CKD, IBD,
  pregnancy, lactation, hormonal therapy).
- Preferences / restrictions (vegetarian, vegan, kosher, halal,
  allergies).

## Method

1. **Estimate TDEE.** Use Mifflin-St Jeor BMR + activity
   multiplier:

   - **BMR (men)**: `(10 × kg) + (6.25 × cm) − (5 × age) + 5`
   - **BMR (women)**: `(10 × kg) + (6.25 × cm) − (5 × age) − 161`
   - Activity multipliers:
     | Level     | Multiplier |
     |-----------|------------|
     | Sedentary | 1.2        |
     | Light (1–3 d/wk) | 1.375 |
     | Moderate (3–5 d/wk) | 1.55 |
     | Heavy (6–7 d/wk) | 1.725 |
     | Athlete (2× day) | 1.9 |

   For known body composition, use Katch-McArdle:
   `BMR = 370 + (21.6 × LBM_kg)`. More accurate when body fat
   % is reliable.

2. **Set calorie target** by goal:
   - **Maintenance**: TDEE.
   - **Lean fat loss**: −15% to −25% of TDEE (typically −300
     to −500 kcal/day). Larger deficits accelerate loss but
     erode lean mass and adherence.
   - **Lean muscle gain**: +5% to +15% of TDEE (typically
     +250 to +500 kcal/day). Larger surpluses inflate fat
     gain.
   - **Recomposition** (gain muscle, lose fat simultaneously):
     near maintenance with high protein; works best for novice
     trainees and returnees.
   - **Athletic performance**: at or slightly above TDEE;
     timing matters more than magnitude.

3. **Set protein target.**
   - **Sedentary / general health**: 0.8–1.2 g/kg (RDA is
     0.8 g/kg as a minimum to prevent deficiency, not optimum).
   - **Active / fat-loss preserving lean mass**: 1.6–2.2 g/kg.
   - **Bodybuilding / hypertrophy / cutting**: 2.0–2.4 g/kg
     of fat-free mass (or use total weight for simplicity if
     LBM unknown).
   - **Older adults (≥65)**: 1.2–1.6 g/kg (anabolic resistance).
   - **Endurance athletes**: 1.4–1.8 g/kg.

4. **Set fat target.**
   - **Minimum**: 0.5–1.0 g/kg to support hormones.
   - **Range**: 20–35% of total energy.
   - **Quality**: prioritize unsaturated (olive, avocado,
     nuts, fatty fish); cap saturated at <10% of energy;
     minimize trans.
   - **Omega-3**: 250–500 mg combined EPA+DHA/day (general);
     higher for cardiometabolic indications under clinician
     supervision.

5. **Set carb target** = remaining energy after protein + fat.
   - 1 g protein = 4 kcal, 1 g carb = 4 kcal, 1 g fat = 9 kcal.
   - **Endurance athletes**: prioritize carb at 5–10 g/kg
     depending on session intensity / duration.
   - **Strength athletes**: 3–6 g/kg.
   - **Sedentary**: lower carb works fine; balance with fat.
   - **Insulin resistance / T2D** (advisory only): lower-carb
     pattern often improves markers; refer to clinician /
     RD before titrating.

6. **Fiber target.**
   - 25 g/day women, 38 g/day men, or 14 g per 1000 kcal.
   - Most users will fall short; surface this explicitly.

7. **Hydration target.**
   - 30–40 mL/kg/day baseline; +500–1000 mL per hour of
     intense exercise.
   - Higher in heat / altitude / lactation.

8. **Output a range, not a point.** Calorie and macro targets
   are estimates with ±10% real-world variance. Give the user
   a daily band rather than a single number.

## Sanity bounds and refusal

- **Do not recommend below BMR** for sustained calorie target
  without medical supervision (very-low-calorie diet =
  clinician-supervised territory).
- **Pregnancy / lactation**: do not prescribe deficits;
  defer to OB/GYN + RD.
- **History of restrictive ED**: avoid exact calorie targets;
  refer to behavioral support and intuitive-eating-aware RD.
- **Adolescents**: refer to pediatrician + RD for weight
  goals.
- **Diagnosed CKD**: protein target is restricted; clinician
  prescribes — agent does not.

## Output

```
:::artifact
template: macro-targets
inputs:
  age: ...
  sex: ...
  height-cm: ...
  weight-kg: ...
  activity: "moderate"
  goal: "lean fat loss"
estimates:
  bmr: ...
  tdee: ...
  goal-calories: { low: ..., target: ..., high: ... }
  protein-g: { low: ..., target: ..., high: ... }
  fat-g: { low: ..., target: ..., high: ... }
  carb-g: { low: ..., target: ..., high: ... }
  fiber-g: ...
  fluid-ml: ...
notes:
  - "Targets are ranges; track 7-day average, not daily exactness."
  - "Re-evaluate in 4 weeks if weight trend doesn't match goal by ±0.5%/week."
referral-flags: []
:::
```

## Common target-setting failures

1. **Single-number prescriptions.** Variance is real; ranges
   adhere better.
2. **Ignoring lean mass.** Calculations on total weight at high
   body fat overstate protein need; underweight users may need
   more.
3. **Excessive deficits.** -1000 kcal/day often backfires:
   muscle loss, hunger, adherence collapse.
4. **Skipping fat floor.** Below 0.5 g/kg of fat for sustained
   periods affects hormones — especially in women.
5. **No re-evaluation cadence.** Targets calibrate over weeks;
   set a re-check.
6. **Disregarding context.** Targets ignored if they conflict
   with the user's culture / schedule / preferences.

## Refusal

- Refuse calorie targets below BMR for sustained use.
- Refuse exact targets for users with eating-disorder history
  unless they explicitly request and are working with a
  behavioral provider.
- Refuse to override clinician-prescribed targets (CKD,
  diabetes, oncology).
