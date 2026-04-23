# polymarket-portfolio-hedging Starter

This starter is derived from 3× real demand signal and is designed to work with the polymarket-prediction partner. It is built using TypeScript, Node, and frontend technologies.

## Environment

To run this starter, you will need to set the following environment variables:

* `POLYMARKET_API_KEY`: Your Polymarket API key
* `POLYMARKET_API_SECRET`: Your Polymarket API secret
* `PREDICTION_MODEL`: The prediction model to use for hedging

You can add these variables to a `.env` file in the root of your project. For example:

```
POLYMARKET_API_KEY=YOUR_API_KEY
POLYMARKET_API_SECRET=YOUR_API_SECRET
PREDICTION_MODEL=YOUR_PREDICTION_MODEL
```

You can also create a `.env.example` file with the following contents:

```
POLYMARKET_API_KEY=
POLYMARKET_API_SECRET=
PREDICTION_MODEL=
```

To fix the previous Jest configuration defect, add the following script to your `package.json` file:

```json
"scripts": {
  "test": "jest"
}
```

And create a `jest.config.js` file with the following contents:

```javascript
module.exports = {
  // Your Jest configuration here
}
```

## Getting Started

To get started with this starter, follow these steps:

1. Clone the repository and install the dependencies: `npm install`
2. Create a `.env` file with your environment variables
3. Run the starter: `npm start`

## Agent-Facing Extension Guide

This starter is designed to work with the polymarket-prediction partner. To extend this starter, you can add new features and functionality to the existing codebase.

## Portfolio Hedging

This starter is designed to provide portfolio hedging functionality using the polymarket-prediction partner. You can use this starter to build a portfolio hedging application that integrates with the Polymarket API.

## Prediction

This starter is designed to work with the polymarket-prediction partner. You can use this starter to build a prediction application that integrates with the Polymarket API.