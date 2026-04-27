# Dashboard Design Template

## Purpose
Design a dashboard that answers specific questions for a specific
audience and drives specific decisions. Dashboards that don't tie to
decisions are wallpaper — they look like data culture but don't
move the org.

## When to use
Trigger when the user is building a new dashboard, redesigning an
existing one, or auditing a dashboard that nobody uses. For ad-hoc
analyses, route to ad-hoc-query.md or exploratory-analysis.md.

## Method

1. **Identify the audience and the decision.**
   - Who looks at this dashboard? Specific role, not "the team."
   - What decision do they make from it? "Whether to escalate,"
     "where to invest next quarter," "whether the launch is
     working."
   - What's the cadence of that decision? Daily / weekly /
     monthly / quarterly.
   - If the answer is "we just want to see what's happening" —
     that's exploration, not a dashboard. Consider a notebook
     instead.
2. **Pick 3–5 KPIs that drive the decision.**
   - **Headline metric**: the one number that signals
     success / failure. Revenue, MAU, NPS, p99 latency.
   - **Diagnostic metrics**: 2–4 numbers that explain why the
     headline moved. Conversion rate, signup rate, error rate.
   - **Operational metrics**: throughput, queue depth, cost per
     unit — only if the audience operates the system.
   - **Vanity metrics to drop**: page views, raw counts of
     things that don't tie to a decision.
3. **Layout in F-pattern (Western reading).**
   - **Top row**: headline KPIs as big numbers + sparkline + Δ
     vs comparison period.
   - **Second row**: diagnostic charts that explain the
     headline movement.
   - **Below the fold**: detail tables, breakdowns, drill-down
     destinations.
4. **Chart-type discipline.**
   - **Line**: time series.
   - **Bar / column**: discrete comparisons (categories, groups).
   - **Stacked bar**: composition over a few categories.
   - **Heatmap**: dense 2-axis comparison.
   - **Scatter**: relationship between two continuous variables.
   - **Pie / donut**: only for ≤4 categories totaling to 100%;
     usually a bar is better.
   - **Sankey**: flow between states.
   - **Funnel**: ordered conversion steps.
   - Avoid: 3D anything, dual-axis charts (almost always a lie),
     pie with >4 slices, gradient-fill bars.
5. **Comparison context.**
   - Every KPI gets a reference: prior period (WoW, MoM, YoY),
     target / SLO, cohort baseline. A number without context is
     decorative.
   - Show absolute *and* relative change. "+$50K (+3.2%)" beats
     either alone.
6. **Filters and segmentation.**
   - Date range (with sensible defaults: 7d, 28d, 90d).
   - Cohort / segment relevant to the decision (region, plan,
     channel).
   - Drill-down: click a bar → see the underlying rows.
7. **Data sources and freshness.**
   - For each KPI: source table, computation logic, refresh
     cadence (real-time / hourly / daily), expected staleness.
   - Owner: who fixes it when it breaks.
   - Last-refresh timestamp visible on the dashboard.
8. **Anomaly handling.**
   - Annotate known events (launches, outages, promo periods).
   - Confidence intervals or comparison bands where statistical
     noise matters.
   - Suppress / flag bad data — never silently drop.
9. **Loading and performance.**
   - First chart < 2s; full dashboard < 5s.
   - Pre-compute heavy aggregations.
   - Cache intelligently; surface "data as of <timestamp>."

## Common dashboard failures

1. **Decision-less.** Pretty charts, no decision tied; nobody
   acts; eventually nobody looks.
2. **Too many KPIs.** 20 metrics on one page = no metrics in the
   reader's head.
3. **Vanity metrics.** Page views, raw counts that look big.
4. **Missing context.** Numbers without prior-period or target
   comparison.
5. **Wrong chart type.** Pie with 12 slices. Stacked bar where
   the user wants to compare line items.
6. **Stale data, stale alert.** Refresh broken for 2 weeks; no
   one notices because no one alerts on data freshness.
7. **No owner.** When the dashboard breaks, no one is on the
   hook.

## Output

```
:::artifact
template: dashboard-design
title: "..."
audience: "..."
decision: "..."
cadence: "weekly"
kpis:
  - { name: "...", source: "...", refresh: "hourly", target: "...", comparison: "WoW + YoY" }
layout:
  row-1: ["KPI cards"]
  row-2: ["trend chart", "channel breakdown"]
  row-3: ["top items table"]
filters: ["date-range", "region", "plan-tier"]
data-sources:
  - { table: "...", refresh: "...", owner: "..." }
performance:
  load-target: "<5s"
  cache-strategy: "..."
:::
```

## Refusal

- The agent will not approve a dashboard without a stated
  decision and audience.
- The agent will not approve dual-axis charts unless explicitly
  justified — they almost always mislead.
- The agent will not approve a dashboard without a freshness
  indicator and an owner.
