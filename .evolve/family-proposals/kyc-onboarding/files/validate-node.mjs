export function validateNode(files, deps) {
  // Validate key files
  if (!files.includes('index.mjs')) {
    throw new Error('Index file not found');
  }
  if (!files.includes('package.json')) {
    throw new Error('Package file not found');
  }

  // Validate dependencies
  if (!deps.includes('typescript')) {
    throw new Error('Typescript dependency not found');
  }
  if (!deps.includes('node')) {
    throw new Error('Node dependency not found');
  }
}