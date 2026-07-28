// blocks-to-artifacts — adapts AgentBlock[] to the
// SandboxWorkbenchArtifact[] shape consumed by @tangle-network/sandbox-ui's
// SandboxWorkbench. This is the bridge that lets a starter-foundry agent
// bundle's :::artifact / :::escalation / :::screener-result / :::audio-cue
// output land in the workbench's artifact pane without per-app glue code.
//
// The mapping is intentionally narrow: each block kind maps to one
// SandboxWorkbenchArtifact discriminated-union variant. Callers can extend
// the registry with `registerBlockMapper` when a bundle ships a
// domain-specific block type.

import type { OpenUIComponentNode } from '@tangle-network/sandbox-ui/openui'
import type { SandboxWorkbenchArtifact } from '@tangle-network/sandbox-ui/workspace'
import type { AgentBlock, ParsedBlock } from './parse-blocks.js'
import { isAgentBlock, parseBlocks } from './parse-blocks.js'

export type { SandboxWorkbenchArtifact }

export type BlockMapper = (block: AgentBlock, index: number) => SandboxWorkbenchArtifact | null

const DEFAULT_MAPPERS: Record<string, BlockMapper> = {
  artifact: (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `artifact-${i}`,
    title: block.attrs.title ?? block.attrs.label ?? 'Artifact',
    content: block.body,
    meta: blockMetadata(block),
  }),
  escalation: (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `escalation-${i}`,
    title: 'Escalation — see a real expert',
    content: block.body,
    meta: blockMetadata(block, { severity: block.attrs.severity ?? 'high' }),
  }),
  'screener-result': (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `screener-${i}`,
    title: `${block.attrs.instrument ?? 'Screener'} result`,
    content: block.body,
    meta: blockMetadata(block, { band: block.attrs.band, score: block.attrs.score }),
  }),
  'audio-cue': (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `audio-${i}`,
    title: block.attrs.title ?? 'Audio cue',
    content: block.body,
    meta: blockMetadata(block, { voiceProfile: block.attrs['voice-profile'] }),
  }),
  suggestion: (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `suggestion-${i}`,
    title: block.attrs.title ?? 'Suggestion',
    content: block.body,
    meta: blockMetadata(block, { priority: block.attrs.priority }),
  }),
  proposal: (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `proposal-${i}`,
    title: block.attrs.title ?? 'Proposal',
    content: block.body,
    meta: blockMetadata(block),
  }),
  filing: (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `filing-${i}`,
    title: block.attrs.title ?? 'Filing',
    content: block.body,
    meta: blockMetadata(block),
  }),
  survey: (block, i) => ({
    kind: 'markdown',
    id: block.attrs.id ?? `survey-${i}`,
    title: block.attrs.title ?? 'Survey',
    content: block.body,
    meta: blockMetadata(block),
  }),
}

const customMappers = new Map<string, BlockMapper>()

export function registerBlockMapper(kind: string, mapper: BlockMapper): void {
  customMappers.set(kind, mapper)
}

export function clearBlockMappers(): void {
  customMappers.clear()
}

/**
 * Convert a stream of parsed blocks into SandboxWorkbenchArtifact[]. Blocks
 * with kind `openui` (or attrs.format === 'openui') become openui artifacts
 * that render via sandbox-ui's OpenUIArtifactRenderer. Unknown block kinds
 * fall through to the markdown default unless a custom mapper is registered.
 */
export function blocksToArtifacts(blocks: ParsedBlock[]): SandboxWorkbenchArtifact[] {
  const out: SandboxWorkbenchArtifact[] = []
  let i = 0
  for (const block of blocks) {
    if (!isAgentBlock(block)) continue
    if (block.attrs.format === 'openui') {
      try {
        const schema: unknown = JSON.parse(block.body)
        if (!isOpenUISchema(schema)) throw new Error('Invalid OpenUI schema')
        out.push({
          kind: 'openui',
          id: block.attrs.id ?? `openui-${i}`,
          title: block.attrs.title ?? block.kind,
          schema,
          meta: blockMetadata(block),
        })
        i++
        continue
      } catch {
        // Fall through to default mapper on bad JSON.
      }
    }
    const mapper = customMappers.get(block.kind) ?? DEFAULT_MAPPERS[block.kind]
    if (mapper) {
      const artifact = mapper(block, i)
      if (artifact) out.push(artifact)
    } else {
      // Unknown kind — emit as markdown with a debug-friendly title.
      out.push({
        kind: 'markdown',
        id: block.attrs.id ?? `unknown-${i}`,
        title: `[${block.kind}]`,
        content: block.body,
        meta: blockMetadata(block, { unknown: true }),
      })
    }
    i++
  }
  return out
}

/**
 * Subscribe to a useSdkSession-style stream and emit artifact updates. The
 * caller passes the assistant message's accumulated text on each chunk; the
 * adapter re-parses + re-emits the full artifact list. Idempotent.
 */
export function makeArtifactStreamAdapter(): {
  feed: (assistantText: string) => SandboxWorkbenchArtifact[]
  reset: () => void
} {
  let lastText = ''
  let lastArtifacts: SandboxWorkbenchArtifact[] = []
  return {
    feed(text: string): SandboxWorkbenchArtifact[] {
      if (text === lastText) return lastArtifacts
      const blocks = parseBlocks(text)
      lastText = text
      lastArtifacts = blocksToArtifacts(blocks)
      return lastArtifacts
    },
    reset() {
      lastText = ''
      lastArtifacts = []
    },
  }
}

function blockMetadata(
  block: AgentBlock,
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    source: `agent-output:${block.kind}`,
    ...extra,
    attrs: block.attrs,
  })
}

function isOpenUISchema(value: unknown): value is OpenUIComponentNode | OpenUIComponentNode[] {
  if (Array.isArray(value)) return value.every(isOpenUINode)
  return isOpenUINode(value)
}

function isOpenUINode(value: unknown): value is OpenUIComponentNode {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  return (
    typeof type === 'string' &&
    [
      'actions',
      'badge',
      'card',
      'code',
      'grid',
      'heading',
      'key_value',
      'markdown',
      'separator',
      'stack',
      'stat',
      'table',
      'text',
    ].includes(type)
  )
}
