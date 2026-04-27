# Churn Risk Analysis (Customer Success)

## Purpose
Identify customers at risk of churning and convert raw escalation incidents
into **themes** that PM can consume as discovery inputs. This is signal
work, not scope work — the output goes to PM Monday morning, not directly
to the sprint backlog.

## When to use
- Monday discovery sync — bring the top-3 churn-risk and top-3 escalation
  themes from the prior week.
- Quarterly health review.
- Any time the operator asks "how is customer X doing?"

## Two outputs from one analysis

### A. Per-customer health score (when the operator names a customer)
A dimensional score on a known customer, used for renewal decisions and
QBR prep.

### B. Cross-customer theme report (Monday default)
A pattern view across the customer base, used to feed PM's discovery
funnel. Themes require **n ≥ 3** customers reporting the same symptom
to count as signal vs anecdote.

## Health-score dimensions (per-customer)

### 1. Product usage (weight: 30%)
- DAU/MAU trend (last 30 days vs prior 30)
- Feature adoption breadth (% of licensed features actively used)
- Session depth (time/session, actions/session) trend
- Score 1–5: 1 = critical decline, 5 = healthy growth

### 2. Support health (weight: 20%)
- Ticket volume trend
- Severity distribution (P1 / P2 / P3)
- Time-to-resolution vs SLA
- Recurring tickets on the same surface (signal of unfixed root cause)

### 3. Sentiment (weight: 25%)
- NPS / CSAT scores
- Executive sponsor sentiment (qualitative — last touch + tone)
- Public mentions (social, review sites) — note any new negative
- Renewal language in conversation ("we're evaluating alternatives" =
  yellow flag minimum)

### 4. Business outcomes (weight: 25%)
- Time-to-value achieved? (named milestones from kickoff)
- Key integration or training milestones met?
- Expansion / upsell signal (additional teams, additional licenses)

### Scoring
Each dimension 1–5. Weighted average gives overall health:
- **Green (4.0–5.0)** — likely to renew, focus on expansion
- **Yellow (2.5–3.9)** — moderate risk, schedule executive check-in
- **Red (1.0–2.4)** — high risk, retention playbook + escalation
- **Stale data** — re-pull dimensions every cycle; never score on >30-day-old data

## Theme-extraction process (Monday default)

### 1. Pull the week's escalations and tickets
Group by customer-reported symptom, not by product surface. "Export is
slow" and "report download takes 30s" are the same theme.

### 2. Cluster by symptom
A theme requires **n ≥ 3 distinct customers** reporting the same symptom.
Below n=3 = anecdote (still log, do not promote to theme).

### 3. Tag each theme with a hypothesis about cause
- Product gap (capability missing or broken)
- Onboarding gap (capability exists, customer can't find it)
- Pricing pressure (customer downgrading, comparing alternatives)
- Workflow pressure (customer's process changed, our product didn't)

### 4. Estimate reach across the customer base
For each theme: how many customers exhibit this pattern even if they
haven't escalated? Use product analytics where available, named segments
where not.

### 5. Recommend handoff
- **Product gap** → PM as discovery input
- **Onboarding gap** → CS internal (training, docs)
- **Pricing pressure** → operator + finance (escalation, not PM)
- **Workflow pressure** → PM if widespread, CS internal if narrow

## Output (`:::artifact template: churn-risk-analysis`)

### Monday default (theme report)
- Top 3 churn-risk customers (red/yellow with one-line cause)
- Top 3 weekly themes (n ≥ 3) with hypothesis and recommended handoff
- Anecdotes to monitor (n=1, n=2) listed but not promoted
- `producedBy: customer-success`, `consumedBy: pm`

### Per-customer (on request)
- Health score (dimensional + overall)
- Trend vs prior cycle
- Recommended actions ranked by impact-to-effort
- Renewal risk if action not taken

## Anti-patterns

- **Anecdote inflation.** Promoting an n=1 escalation to a "theme" because
  the customer is loud or large. Stays an anecdote until n ≥ 3.
- **Stale scoring.** Reporting last quarter's health score as current.
- **Auto-promotion.** Pushing customer asks straight into eng-manager's
  sprint. CS is signal; PM converts to scope.
- **Sentiment laundering.** Reporting "customer is happy" without
  evidence. Sentiment requires a named touchpoint and quoted language.

## Escalation rule
A red customer with **<60 days to renewal** OR a theme with hypothesis
"pricing pressure" requires an `:::escalation` block — operator + finance
own the response, not PM.
