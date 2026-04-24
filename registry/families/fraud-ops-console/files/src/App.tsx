import React, { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <header className="App-header">
        <p>Fraud Ops Console</p>
        <p>Domain: Fraud Detection and Risk Management</p>
        <button onClick={() => setCount(count + 1)}>Increment</button>
        <p>Count: {count}</p>
      </header>
    </div>
  );
}

export default App;