import type {
  PreviewHint,
  PrimaryProjectManifest as PrimaryProjectManifestShape,
} from '../types.js'

export type { PrimaryProjectManifest } from '../types.js'

export const PRIMARY_PROJECT_MANIFEST_PATH = '.starter-foundry/primary-project.json'

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:/
const PRIMARY_PROJECT_KEYS = new Set([
  'schemaVersion',
  'projectId',
  'cwd',
  'composeReportPath',
  'preview',
])
const PREVIEW_KEYS = new Set(['path', 'port'])

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true
  }
  return false
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !hasControlCharacter(value)
}

function isSafeRelativePath(value: unknown): value is string {
  if (
    !isText(value) ||
    value.startsWith('/') ||
    value.includes('\\') ||
    WINDOWS_DRIVE_PATH.test(value)
  ) {
    return false
  }
  if (value === '.') return true

  return value
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

function isPreviewPath(value: unknown): value is string {
  if (!isText(value) || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false
  }

  return !value.split('/').some((segment) => segment === '.' || segment === '..')
}

function isPort(value: unknown): value is string | number {
  const port =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9]\d*$/.test(value)
        ? Number(value)
        : Number.NaN

  return Number.isInteger(port) && port >= 1 && port <= 65_535
}

function expectedComposeReportPath(cwd: string): string {
  return cwd === '.'
    ? '.starter-foundry/compose-report.json'
    : `${cwd}/.starter-foundry/compose-report.json`
}

function validatePreview(value: unknown, issues: string[]): PreviewHint | null | undefined {
  if (value === null) return null
  if (!isObject(value)) {
    issues.push('preview must be null or an object')
    return undefined
  }

  for (const key of Object.keys(value)) {
    if (!PREVIEW_KEYS.has(key)) issues.push(`preview has unsupported field "${key}"`)
  }

  const hasPath = hasOwn(value, 'path')
  const hasPort = hasOwn(value, 'port')
  if (!hasPath && !hasPort) {
    issues.push('preview must include path or port')
  }
  if (hasPath && !isPreviewPath(value.path)) {
    issues.push('preview.path must be an absolute, non-network URL path')
  }
  if (hasPort && !isPort(value.port)) {
    issues.push('preview.port must be an integer from 1 through 65535')
  }

  if (
    (!hasPath && !hasPort) ||
    (hasPath && !isPreviewPath(value.path)) ||
    (hasPort && !isPort(value.port))
  ) {
    return undefined
  }

  return {
    ...(hasPath ? { path: value.path as string } : {}),
    ...(hasPort ? { port: value.port as string | number } : {}),
  }
}

export class PrimaryProjectManifestValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`PrimaryProjectManifest validation failed: ${issues.join('; ')}`)
    this.name = 'PrimaryProjectManifestValidationError'
  }
}

/**
 * Validate and normalize the versioned primary-project artifact.
 *
 * This module intentionally has no filesystem or process dependency so every
 * consumer can validate parsed JSON before using its workspace paths.
 */
export function validatePrimaryProjectManifest(input: unknown): PrimaryProjectManifestShape {
  if (!isObject(input)) {
    throw new PrimaryProjectManifestValidationError(['root must be an object'])
  }

  const issues: string[] = []
  for (const key of Object.keys(input)) {
    if (!PRIMARY_PROJECT_KEYS.has(key)) issues.push(`root has unsupported field "${key}"`)
  }

  if (input.schemaVersion !== 1) issues.push('schemaVersion must be 1')
  if (!isText(input.projectId)) issues.push('projectId must be a non-empty string')
  if (!isSafeRelativePath(input.cwd)) issues.push('cwd must be a canonical relative path')
  if (!isSafeRelativePath(input.composeReportPath)) {
    issues.push('composeReportPath must be a canonical relative path')
  }

  const preview = validatePreview(input.preview, issues)
  if (
    isSafeRelativePath(input.cwd) &&
    isSafeRelativePath(input.composeReportPath) &&
    input.composeReportPath !== expectedComposeReportPath(input.cwd)
  ) {
    issues.push('composeReportPath must point to the primary project compose report')
  }

  if (issues.length > 0 || preview === undefined) {
    throw new PrimaryProjectManifestValidationError(issues)
  }

  return {
    schemaVersion: 1,
    projectId: input.projectId as string,
    cwd: input.cwd as string,
    composeReportPath: input.composeReportPath as string,
    preview,
  }
}
