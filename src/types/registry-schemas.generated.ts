// AUTO-GENERATED from registry/_schemas/*.json by scripts/gen-types-from-schemas.ts.
// Do not edit by hand — re-run the generator after schema changes.
// `pnpm test` enforces this file is in sync via scripts/gen-types-from-schemas.ts --check.

/* eslint-disable */
/** Bundle-side spec; deploy script translates into a Tangle Sandbox AgentProfile and emits harness-native files (AGENTS.md, agents.json) at the workspace root. */
export interface Agent {
  "name": string
  "description"?: string
  "version": string
  "tags"?: Array<string>
  "harness"?: "opencode" | "claude-code" | "hermes"
  "hooks"?: {
  "pre"?: string
  "post"?: string
}
  "workspace"?: {
  "root"?: string
}
  "prompt": {
  "systemPromptFile"?: string
  "instructions"?: Array<string>
}
  "model"?: {
  "preferred"?: string
  "fallback"?: Array<string>
}
  "tools"?: Record<string, boolean>
  "permissions"?: Record<string, "allow" | "ask" | "deny">
  "mcp"?: Record<string, unknown>
  "subagents"?: Record<string, {
  "description"?: string
  "systemPromptFile": string
  "model"?: string
  "tools"?: Record<string, boolean>
  "permissions"?: Record<string, "allow" | "ask" | "deny">
  "temperature"?: number
  "maxSteps"?: number
}>
  "resources"?: {
  "files"?: Array<{
  "source": string
  "target"?: string
}>
}
}

export interface Buildhints {
  "pages"?: Array<string>
  "apiRoutes"?: Array<string>
  "components"?: Array<string>
  "dataModels"?: Array<string>
  "integrations"?: Array<string>
  "architectureNotes"?: Array<string>
  "firstSteps"?: Array<string>
  "gotchas"?: Array<string>
  "whenToUse"?: string
  "placeholders"?: Array<{
  "path": string
  "description": string
}>
}

export interface Family {
  "id": string
  "description": string
  "tags": Array<string>
  "taxonomy"?: {
  "language"?: string
  "runtime"?: string
  "surface"?: string
}
  "slots"?: Record<string, {
  "options"?: Array<string>
  "default"?: string
}>
  "requires"?: Array<string>
  "includes"?: Array<string>
  "defaults"?: Record<string, unknown>
  "files"?: Array<{
  "source": string
  "target": string
}>
  "validationChecks"?: Array<{
  "type": "file-exists" | "node-syntax" | "http-start" | "command-success" | "python-compile" | "prompt-frontmatter-valid" | "cron-syntax-valid" | "template-index-valid" | "agents-md-valid" | "methodology-index-valid" | "schedule-valid"
  "path"?: string
  "command"?: Array<string>
  "expect"?: string
  "env"?: Record<string, unknown>
  "port"?: string
  "runOnce"?: boolean
}>
  "contextHints"?: {
  "commands"?: Array<string>
  "entrypoints"?: Array<string>
  "preview"?: unknown
  "extensionPoints"?: Array<string>
}
  "keywords"?: Array<string>
  "tieredKeywords"?: {
  "tier1"?: Array<string>
  "tier2"?: Array<string>
  "tier3"?: Array<string>
  "archetypes"?: Array<string>
}
  "scoring"?: {
  "boost"?: Record<string, number>
}
  "buildHints"?: Buildhints
  "domainPack"?: {
  "domain": {
  "family": string
  "provider"?: string
  "protocol"?: string
  "runtime"?: string
  "surface"?: string
}
  "provides": Array<string>
  "requires"?: Array<string>
  "ambiguityGroup"?: string
  "validationCommands"?: Array<string>
  "authenticitySignals"?: Array<string>
  "authenticityGroups"?: Array<{
  "id": string
  "description"?: string
  "minRequired"?: number
  "signals": Array<string>
}>
  "routingPrompts"?: Array<{
  "prompt": string
  "expectedFamily"?: string
  "expectedLayers"?: Array<string>
}>
}
}

export interface Layer {
  "id": string
  "description": string
  "group"?: string
  "slot"?: string
  "appliesTo"?: Array<string>
  "defaults"?: Record<string, unknown>
  "files"?: Array<{
  "source": string
  "target": string
}>
  "validationChecks"?: Array<Record<string, unknown>>
  "contextHints"?: {
  "commands"?: Array<string>
  "entrypoints"?: Array<string>
  "extensionPoints"?: Array<string>
}
  "keywords"?: Array<string>
  "tieredKeywords"?: {
  "tier1"?: Array<string>
  "tier2"?: Array<string>
  "tier3"?: Array<string>
  "archetypes"?: Array<string>
}
  "capabilityRequires"?: Array<string>
  "variants"?: Array<string>
  "buildHints"?: Buildhints
  "packageDeps"?: {
  "dependencies"?: Record<string, string>
  "devDependencies"?: Record<string, string>
}
  "provides"?: Array<string>
  "requires"?: Array<string>
  "conflictsWith"?: Array<string>
  "domainPack"?: {
  "domain": {
  "family": string
  "provider"?: string
  "protocol"?: string
  "runtime"?: string
  "surface"?: string
}
  "provides": Array<string>
  "requires"?: Array<string>
  "ambiguityGroup"?: string
  "validationCommands"?: Array<string>
  "authenticitySignals"?: Array<string>
  "authenticityGroups"?: Array<{
  "id": string
  "description"?: string
  "minRequired"?: number
  "signals": Array<string>
}>
  "routingPrompts"?: Array<{
  "prompt": string
  "expectedFamily"?: string
  "expectedLayers"?: Array<string>
}>
}
}

export interface Partner {
  "id": string
  "description": string
  "appliesTo"?: Array<string>
  "defaults"?: Record<string, unknown>
  "slotDefaults"?: Record<string, string>
  "files"?: Array<{
  "source": string
  "target": string
}>
  "buildHints"?: Buildhints
}

