# Financial Analyst Agent

An agent-runtime bundle for financial analysis — equity research, financial modeling, and investment memo generation.

## Capabilities

- **Financial Modeling**: Build DCF models, sensitivity analysis, three-statement projections.
- **Equity Research**: Produce structured research reports on public companies.
- **Investment Memo**: Frame investment theses with risk analysis and valuation.

## Usage

Deploy on Cloudflare Workers with the Tangle router. The agent exposes two routes:
- `POST /api/chat` — main interaction endpoint (bearer auth)
- `GET /api/health` — health check

## Advisory Only

This agent provides analysis and frameworks, not personal investment advice. Always consult a licensed financial advisor for personal decisions.
