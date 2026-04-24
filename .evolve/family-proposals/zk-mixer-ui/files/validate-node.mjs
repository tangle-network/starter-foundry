import assert from 'assert';
import { readFile } from 'fs/promises';
import { join } from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

const validateNode = async () => {
  // Validate key files
  const packageJsonPath = join(__dirname, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  assert(packageJson.name === 'zk-mixer-ui', 'Invalid package name');

  // Validate dependencies structure
  const dependencies = packageJson.dependencies;
  assert(dependencies && typeof dependencies === 'object', 'Invalid dependencies');

  // Add more validation logic as needed
};

validateNode();