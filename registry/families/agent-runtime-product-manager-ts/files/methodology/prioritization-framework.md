# Prioritization Framework

## Overview
A falsifiable prioritization framework to rank features or initiatives based on hypothesis, metric, and kill criterion.

## Dimensions

### 1. Hypothesis
- What do we believe will happen if we build this?
- Example: "Adding a referral program will increase new user sign-ups by 20% within 30 days."

### 2. Primary Metric
- What single metric will tell us if the hypothesis is true?
- Must be measurable, timely, and actionable.
- Example: "Weekly new user sign-ups from referral links."

### 3. Sample-Size Proxy
- How many users or events do we need to observe before we can draw a conclusion?
- Use statistical significance or a practical threshold.
- Example: "At least 100 referral sign-ups or 30 days, whichever comes first."

### 4. Kill Criterion
- What result would cause us to stop or pivot?
- Must be pre-defined, not post-hoc.
- Example: "If referral sign-ups are less than 5% of total sign-ups after 30 days, kill."

### 5. Effort Estimate
- Rough order of magnitude: days, weeks, months.
- Use T-shirt sizes (S, M, L, XL) or story points.

### 6. Confidence Level
- How confident are we in the hypothesis? (Low, Medium, High)
- Based on existing data, user research, or analogous examples.

## Scoring
For each initiative, compute a priority score:
- Impact (1-5) x Confidence (1-5) / Effort (1-5)
- Higher score = higher priority.

## Usage
List all candidate initiatives. For each, fill out the six dimensions. Score and rank. Review the top 3 with the user and challenge the kill criteria.
