import React, { useState } from 'react';
import './App.css';

function App() {
  const [hedgingStrategies, setHedgingStrategies] = useState([
    { id: 1, name: 'Strategy 1' },
    { id: 2, name: 'Strategy 2' },
  ]);

  const [portfolioOptimization, setPortfolioOptimization] = useState([
    { id: 1, name: 'Optimization 1' },
    { id: 2, name: 'Optimization 2' },
  ]);

  const [riskManagement, setRiskManagement] = useState([
    { id: 1, name: 'Management 1' },
    { id: 2, name: 'Management 2' },
  ]);

  return (
    <div className="App">
      <h1>Polymarket Portfolio Hedging</h1>
      <h2>Hedging Strategies:</h2>
      <ul>
        {hedgingStrategies.map((strategy) => (
          <li key={strategy.id}>{strategy.name}</li>
        ))}
      </ul>
      <h2>Portfolio Optimization:</h2>
      <ul>
        {portfolioOptimization.map((optimization) => (
          <li key={optimization.id}>{optimization.name}</li>
        ))}
      </ul>
      <h2>Risk Management:</h2>
      <ul>
        {riskManagement.map((management) => (
          <li key={management.id}>{management.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;