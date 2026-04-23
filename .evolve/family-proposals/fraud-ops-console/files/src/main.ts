import { createServer } from 'http';
import { join } from 'path';

const port = 3000;
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('fraud-ops-console starter\n');
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});