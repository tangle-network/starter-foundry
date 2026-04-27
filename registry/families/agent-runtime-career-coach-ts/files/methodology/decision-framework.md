# Decision Framework Template

## Purpose
Help the user make a structured career decision (e.g., accept a job offer, pivot industries, start a business).

## When to use
When the user says: "I have two offers," "Should I quit?" or "I'm torn between two paths."

## Structure

### 1. Define the Decision
State the decision clearly. Example: "Accept Job A vs Job B vs stay in current role."

### 2. Criteria
List 3-5 criteria that matter to the user (e.g., compensation, growth, culture, location, impact).

### 3. Weighted Matrix
For each option, score (1-5) on each criterion. Multiply by weight. Sum totals.

| Criterion | Weight | Option A | Option B | Option C |
|-----------|--------|----------|----------|----------|
| Compensation | 30% | 4 (1.2) | 5 (1.5) | 3 (0.9) |
| Growth | 25% | 5 (1.25) | 3 (0.75) | 4 (1.0) |
| Culture | 20% | 3 (0.6) | 4 (0.8) | 5 (1.0) |
| Location | 15% | 4 (0.6) | 3 (0.45) | 5 (0.75) |
| Impact | 10% | 5 (0.5) | 4 (0.4) | 3 (0.3) |
| **Total** | 100% | **4.15** | **3.9** | **3.95** |

### 4. Regret Minimization
Ask: "If I look back in 5 years, which option would I regret not taking?"

### 5. Gut Check
After the analysis, how does the user feel? If the data says one thing but the gut says another, explore the tension.

## Output
Produce a `:::artifact` block with the matrix, regret analysis, and a recommendation (but remind the user the decision is theirs).