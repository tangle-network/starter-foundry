#!/usr/bin/env node
// Auto-generates TypeScript interfaces from registry/_schemas/*.json into
// src/types/registry-schemas.generated.ts. Eliminates manual drift between
// the JSON Schema (what validate-registry.mjs enforces) and the TS types
// (what compose/planner code reads).
//
// The generator handles the subset of JSON Schema actually used by the
// registry schemas: type, properties, required, additionalProperties,
// $ref, enum, items, pattern, minLength, anyOf. Not a full JSON-Schema
// → TS compiler; extend when a new schema construct shows up.
//
// Usage:
//   node scripts/gen-types-from-schemas.mjs           # regenerate
//   node scripts/gen-types-from-schemas.mjs --check   # fail if stale

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA_DIR = join(REPO, 'registry/_schemas')
const OUT_PATH = join(REPO, 'src/types/registry-schemas.generated.ts')

const CHECK = process.argv.includes('--check')

function titleCase(s) {
  return s.replace(/(?:^|-|_)(\w)/g, (_, c) => c.toUpperCase())
}

function tsTypeFor(schema, definitions = {}) {
  if (!schema) return 'unknown'
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop().replace(/\.json$/, '')
    const name = titleCase(refName.replace(/\.schema$/, ''))
    return name
  }
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(' | ')
  if (schema.anyOf) return schema.anyOf.map((s) => tsTypeFor(s, definitions)).join(' | ')
  if (schema.const !== undefined) return JSON.stringify(schema.const)

  switch (schema.type) {
    case 'string': return 'string'
    case 'number': case 'integer': return 'number'
    case 'boolean': return 'boolean'
    case 'null': return 'null'
    case 'array': return `Array<${tsTypeFor(schema.items ?? {}, definitions)}>`
    case 'object': {
      if (!schema.properties) {
        if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          return `Record<string, ${tsTypeFor(schema.additionalProperties, definitions)}>`
        }
        return 'Record<string, unknown>'
      }
      const required = new Set(schema.required ?? [])
      const fields = Object.entries(schema.properties).map(([k, v]) => {
        const opt = required.has(k) ? '' : '?'
        return `  ${JSON.stringify(k)}${opt}: ${tsTypeFor(v, definitions)}`
      })
      return `{\n${fields.join('\n')}\n}`
    }
    default:
      return 'unknown'
  }
}

function genInterface(name, schema) {
  const doc = schema.description ? `/** ${schema.description} */\n` : ''
  const body = tsTypeFor(schema)
  // If top-level is object, emit as interface; otherwise as type alias.
  if (schema.type === 'object' && schema.properties) {
    return `${doc}export interface ${name} ${body.replace(/^{\n/, '{\n').trimEnd()}\n`
  }
  return `${doc}export type ${name} = ${body}\n`
}

const schemas = readdirSync(SCHEMA_DIR)
  .filter((f) => f.endsWith('.schema.json'))
  .sort()
  .map((f) => ({
    file: f,
    name: titleCase(f.replace(/\.schema\.json$/, '')),
    schema: JSON.parse(readFileSync(join(SCHEMA_DIR, f), 'utf8')),
  }))

const header = [
  '// AUTO-GENERATED from registry/_schemas/*.json by scripts/gen-types-from-schemas.mjs.',
  '// Do not edit by hand — re-run the generator after schema changes.',
  '// `pnpm test` enforces this file is in sync via scripts/gen-types-from-schemas.mjs --check.',
  '',
  '/* eslint-disable */',
  '',
]

const body = schemas.map(({ name, schema }) => genInterface(name, schema)).join('\n')
const content = header.join('\n') + body + '\n'

if (CHECK) {
  if (!existsSync(OUT_PATH)) {
    console.error(`generated types missing at ${OUT_PATH}`)
    process.exit(1)
  }
  const existing = readFileSync(OUT_PATH, 'utf8')
  if (existing.trim() !== content.trim()) {
    console.error(`generated types are stale at ${OUT_PATH} — run: node scripts/gen-types-from-schemas.mjs`)
    process.exit(1)
  }
  console.log(`✓ generated types in sync (${schemas.length} schemas)`)
} else {
  writeFileSync(OUT_PATH, content)
  console.log(`wrote ${OUT_PATH} (${schemas.length} schemas)`)
}
