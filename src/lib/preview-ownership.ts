export const PREVIEW_OWNERSHIP_HEADING = 'Preview ownership'

export const PREVIEW_OWNERSHIP_LINES = [
  'The host platform starts the persistent development server and publishes its preview.',
  'Do not call local sidecar endpoints, create preview links, or start a long-running development server unless the host explicitly asks.',
  'Before responding, run every listed build or validation command that applies and fix any failures.',
] as const

export const PREVIEW_OWNERSHIP_SUMMARY = PREVIEW_OWNERSHIP_LINES.join(' ')
