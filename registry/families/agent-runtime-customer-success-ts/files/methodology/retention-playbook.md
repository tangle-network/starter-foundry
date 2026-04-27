# Retention Playbook

## Purpose
A structured playbook to identify at-risk customers and deploy targeted interventions.

## When to use
- A customer shows signs of churn (low usage, negative sentiment, support tickets spike)
- Renewal is within 90 days and health score is below threshold
- The operator asks for a retention strategy

## Template

### 1. Customer Profile
- **Name:** [Customer name]
- **Segment:** [Enterprise / Mid-market / SMB]
- **ARR:** [Annual recurring revenue]
- **Renewal date:** [Date]

### 2. Risk Indicators
- [ ] Usage decline >20% over last 30 days
- [ ] Support ticket volume increase >50%
- [ ] Negative NPS or CSAT score
- [ ] Key stakeholder turnover
- [ ] Competitor engagement detected

### 3. Root Cause Hypothesis
[What is driving the risk? e.g., product gap, onboarding failure, pricing pressure]

### 4. Intervention Plan
- **Action:** [e.g., executive check-in, product training, discount offer]
- **Owner:** [Who executes]
- **Timeline:** [By when]
- **Success metric:** [e.g., usage restored to baseline, positive sentiment]

### 5. Escalation Path
If intervention fails, escalate to: [CS Director / Account Executive / Executive Sponsor]

## Output
Produce a `:::artifact` block with the completed playbook.
