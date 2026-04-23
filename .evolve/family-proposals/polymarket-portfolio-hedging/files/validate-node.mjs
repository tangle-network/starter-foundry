import { validateNode } from '@polymarket/validation';
import { readFileSync } from 'fs';

const filePath = 'node_modules/@polymarket/validation/package.json';
const fileContent = readFileSync(filePath, 'utf8');

validateNode(fileContent);

// Add script to package.json
const packageJson = JSON.parse(fileContent);
packageJson.scripts = packageJson.scripts || {};
packageJson.scripts.validate = 'node validate-node.mjs';
const packageJsonString = JSON.stringify(packageJson, null, 2);

// Create .env.example
const envExample = `# Example environment variables for polymarket-portfolio-hedging
POLYMARKET_PREDICTION_API_KEY=
POLYMARKET_PREDICTION_API_SECRET=`;

// Write updated package.json and .env.example
readFileSync('package.json', 'utf8');
const updatedPackageJson = JSON.parse(packageJsonString);
const fs = require('fs');
fs.writeFileSync('package.json', JSON.stringify(updatedPackageJson, null, 2));
fs.writeFileSync('.env.example', envExample);