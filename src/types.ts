// Re-export from the split type modules. The 500-line monolith was split
// into src/types/{registry,compose,planner,eval}.ts on 2026-04-25 for
// senior-level modularization. Every existing `import from '../types.js'`
// continues to work via this re-export — the public type surface is
// unchanged.
//
// New code should import from the specific module instead:
//   import type { FamilyManifest } from './types/registry.js'
//   import type { ComposeSpec } from './types/compose.js'
// This re-export stays for backward compat + the package.json
// `./types` public export.

export * from './types/index.js'
