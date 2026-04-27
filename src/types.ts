// Re-export barrel for the public `./types` entry in package.json.
//
// Internal callers should import from the specific module instead:
//   import type { FamilyManifest } from './types/registry.js'
//   import type { ComposeSpec } from './types/compose.js'

export * from './types/index.js'
