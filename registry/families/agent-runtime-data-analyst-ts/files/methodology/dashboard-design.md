# Dashboard Design Template

## Purpose
Design a dashboard that answers a specific set of questions with clear KPIs and visualizations.

## Steps

1. **Define the audience and questions** — Who will use this dashboard? What decisions will it inform?
2. **Select KPIs** — Choose 3–5 key metrics that directly answer the questions. Avoid vanity metrics.
3. **Design layout** — Sketch a wireframe: top row for headline KPIs, below for trend charts, breakdowns, and tables.
4. **Choose chart types** — Line for trends, bar for comparisons, pie/donut sparingly, table for details.
5. **Specify filters and interactivity** — Date range, segment, drill-down.
6. **Document data sources and refresh cadence** — Where does the data come from? How often is it updated?

## Output
- `:::artifact` block with the dashboard spec: title, KPIs, chart descriptions, layout, filters, data sources.
- Optionally, a `:::code` block with a mockup using a library (e.g., plotly code snippet).

## Example

Dashboard: "Weekly Sales Performance"
- KPIs: Revenue, Orders, AOV, Conversion Rate
- Charts: Revenue trend (line), Orders by channel (bar), Top products (table)
- Filters: Date range, Region