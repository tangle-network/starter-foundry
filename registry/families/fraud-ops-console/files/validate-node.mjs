import { console } from 'console';
import { readFile } from 'fs/promises';
import { join } from 'path';

const requiredFiles = ['package.json', 'tsconfig.json'];
const requiredDeps = ['typescript', '@types/node'];

async function validateNode() {
  try {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'));
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};

    // Check required files
    for (const file of requiredFiles) {
      if (!(await fileExists(join(process.cwd(), file)))) {
        throw new Error(`Required file ${file} not found`);
      }
    }

    // Check required dependencies
    for (const dep of requiredDeps) {
      if (!deps[dep] && !devDeps[dep]) {
        throw new Error(`Required dependency ${dep} not found`);
      }
    }

    // Check for 'dev' script in package.json
    if (!packageJson.scripts || !packageJson.scripts.dev) {
      throw new Error("Missing 'dev' script in package.json");
    }

    console.log('Validation successful');
  } catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(1);
  }
}

async function fileExists(filePath) {
  try {
    await readFile(filePath, 'utf8');
    return true;
  } catch {
    return false;
  }
}

validateNode();