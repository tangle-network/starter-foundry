import { createServer } from 'http';
import { polymarketPrediction } from './polymarket-prediction';

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('polymarket-portfolio-hedging starter\n');
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});

const prediction = polymarketPrediction();
console.log(prediction);