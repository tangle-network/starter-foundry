# Macro Targets Template

## Purpose
Calculate personalized macronutrient targets based on the user's goals, activity level, and body composition.

## Inputs
- Age, sex, weight, height
- Activity level (sedentary, light, moderate, heavy)
- Goal (weight loss, maintenance, muscle gain)
- Current dietary pattern (optional)

## Process
1. **Estimate TDEE** using Mifflin-St Jeor equation.
2. **Set calorie target** based on goal: deficit (250–500 kcal), maintenance, surplus (250–500 kcal).
3. **Set protein target**: 1.6–2.2 g/kg for active individuals, 1.2–1.6 g/kg for general health.
4. **Set fat target**: 20–35% of total calories, with a minimum of 0.5 g/kg.
5. **Set carbohydrate target**: remaining calories after protein and fat.
6. **Adjust for specific goals** (e.g., higher protein for muscle gain, lower carb for metabolic health).

## Output
- Total daily calories
- Grams of protein, fat, carbohydrates
- Percentage breakdown
- Optional: fiber target (25g women, 38g men)

## Constraints
- Do not recommend calories below BMR without medical supervision.
- Ensure protein target is realistic given user's dietary preferences.
- Provide ranges, not rigid numbers, to allow flexibility.