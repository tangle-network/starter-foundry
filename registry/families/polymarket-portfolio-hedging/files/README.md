# polymarket-portfolio-hedging starter
## Quickstart
To get started with the polymarket-portfolio-hedging starter, run the following commands:
```bash
npm install
npm run dev
```
or
```bash
pnpm install
pnpm run dev
```
This will install the required dependencies and start the development server.

## Environment
The following environment variables are used in this project:
* VITE_POLYMARKET_API_KEY: API key for Polymarket, obtain from Polymarket dashboard
* VITE_POLYMARKET_API_SECRET: API secret for Polymarket, obtain from Polymarket dashboard
* VITE_PORTFOLIO_HEDGING_STRATEGY: hedging strategy to use, e.g. "mean-variance" or "black-litterman", default is "mean-variance"
* VITE_RISK_FREE_RATE: risk-free rate, e.g. 0.02 for 2%, default is 0.02
* VITE_EXPECTED_RETURN: expected return, e.g. 0.08 for 8%, default is 0.08

## Architecture
The polymarket-portfolio-hedging starter consists of two main components: `src/main` and `src/App`. 
* `src/main` contains the main application logic, including the hedging strategy and portfolio optimization.
* `src/App` contains the frontend code, including the user interface and API calls to Polymarket.
The project uses the following dependencies:
* `polymarket-js`: Polymarket JavaScript library for interacting with the Polymarket API
* `typescript`: TypeScript compiler and type checker
* `vite`: Vite development server and build tool
* `react`: React JavaScript library for building user interfaces

## Extension Points
The following files are likely to be edited when building on this starter:
* `src/main/hedgingStrategy.ts`: implements the hedging strategy, e.g. mean-variance or black-litterman
* `src/App/components/Portfolio.tsx`: displays the portfolio and allows user input for hedging strategy and risk parameters
* `src/App/api/polymarket.ts`: contains API calls to Polymarket, e.g. for fetching market data or submitting orders