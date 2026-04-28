# agent-runtime-data-analyst-ts

Data analyst agent bundle — SQL, Python, and visualization for ad-hoc analytics, dashboards, and data-quality checks.

## Capabilities

- **ad-hoc-query**: Write and execute SQL queries to answer specific business questions.
- **exploratory-analysis**: Explore datasets with Python (pandas, matplotlib, seaborn, plotly).
- **dashboard-design**: Design dashboards with KPIs, charts, and filters.
- **data-quality-audit**: Assess data completeness, uniqueness, consistency, validity, and timeliness.

## Usage

Deploy on Cloudflare Workers with the Tangle agent-runtime substrate.

### Routes

- `POST /api/chat` — Bearer auth, calls tools: sql-query, python-exec, viz-render, data-quality-check
- `GET /api/health` — No auth, health check

### Environment Variables

- `TANGLE_API_KEY` — Required for Tangle integration

## Development

```bash
npm install
npm run dev
```

## License

MIT