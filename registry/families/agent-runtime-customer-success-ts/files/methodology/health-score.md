# Health Score Model

## Purpose
Quantify customer health using leading and lagging indicators to predict renewal likelihood.

## When to use
- Monthly/quarterly health review
- Before QBR preparation
- When the operator asks "how is this customer doing?"

## Dimensions

### 1. Product Usage (weight: 30%)
- DAU/MAU trend (last 30 days vs previous 30)
- Feature adoption breadth (% of licensed features used)
- Session depth (time per session, actions per session)

### 2. Support Health (weight: 20%)
- Ticket volume trend
- Severity distribution (P1/P2/P3)
- Time to resolution (TTR) vs SLA

### 3. Sentiment (weight: 25%)
- NPS / CSAT survey scores
- Executive sponsor sentiment (qualitative)
- Social media / review mentions

### 4. Business Outcomes (weight: 25%)
- Time-to-value (TTV) achieved?
- Key milestones met (e.g., integration complete, training done)
- Expansion revenue / upsell potential

## Scoring
Each dimension scored 1-5 (1=critical risk, 5=excellent). Overall score = weighted average.

- **Green (4.0-5.0):** Healthy, likely to renew
- **Yellow (2.5-3.9):** Moderate risk, needs attention
- **Red (1.0-2.4):** High risk, immediate intervention required

## Output
Produce a `:::artifact` block with the scorecard and recommended actions.
