// AgentsMdPreview — renders a bundle's AGENTS.md content with the same
// block parser the runtime UI uses. AGENTS.md often contains :::artifact /
// :::suggestion fences (the agent-output:blocks layer's grammar) that the
// blocks-renderer adapter knows how to render.
//
// Single-agent bundles: shows AGENTS.md body + parsed-block summary chips.
// Multi-agent bundles:   shows orchestrator AGENTS.md + a list of role names
// pulled from agents.json so users can see the team composition before
// deploying.

import { blocksToArtifacts } from '../lib/blocks-to-artifacts'
import { parseBlocks } from '../lib/parse-blocks'
import type { Bundle } from '../lib/catalog'

interface Props {
  bundle: Bundle
}

interface AgentsJsonShape {
  agents?: Array<{ name?: string; role?: string; description?: string }>
}

function isAgentsJsonShape(x: unknown): x is AgentsJsonShape {
  return typeof x === 'object' && x !== null
}

function extractFrontmatter(body: string): { fm: Record<string, string>; rest: string } {
  if (!body.startsWith('---\n')) return { fm: {}, rest: body }
  const close = body.indexOf('\n---\n', 4)
  if (close === -1) return { fm: {}, rest: body }
  const fmRaw = body.slice(4, close)
  const rest = body.slice(close + 5)
  const fm: Record<string, string> = {}
  for (const line of fmRaw.split('\n')) {
    const idx = line.indexOf(':')
    if (idx < 1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    fm[key] = value
  }
  return { fm, rest }
}

export function AgentsMdPreview({ bundle }: Props) {
  if (!bundle.agentsMdBody) {
    return (
      <section aria-labelledby='agents-md-heading'>
        <h2 id='agents-md-heading' className='mp-h2'>
          AGENTS.md preview
        </h2>
        <p className='mp-muted'>
          This bundle does not declare an AGENTS.md, or the file could not be
          read from the registry.
        </p>
      </section>
    )
  }

  const { fm, rest } = extractFrontmatter(bundle.agentsMdBody)
  const blocks = parseBlocks(rest)
  const artifacts = blocksToArtifacts(blocks)

  let agentsJsonRoles: string[] = []
  if (bundle.isMultiAgent && isAgentsJsonShape(bundle.agentsJson)) {
    const ag = bundle.agentsJson.agents
    if (Array.isArray(ag)) {
      agentsJsonRoles = ag
        .map((a) => a.name ?? a.role ?? '')
        .filter((s): s is string => Boolean(s))
    }
  }

  return (
    <section aria-labelledby='agents-md-heading'>
      <h2 id='agents-md-heading' className='mp-h2'>
        AGENTS.md preview
      </h2>

      {Object.keys(fm).length > 0 && (
        <div className='mp-card' style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: '0.875rem' }}>Frontmatter</strong>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '0.875rem' }}>
            {Object.entries(fm).map(([k, v]) => (
              <DefRow key={k} k={k} v={v} />
            ))}
          </dl>
        </div>
      )}

      {agentsJsonRoles.length > 0 && (
        <div className='mp-card' style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: '0.875rem' }}>Team roles</strong>
          <div style={{ marginTop: 8 }}>
            {agentsJsonRoles.map((r) => (
              <span key={r} className='mp-tag'>
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {artifacts.length > 0 && (
        <div className='mp-card' style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: '0.875rem' }}>
            Output blocks declared ({artifacts.length})
          </strong>
          <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: '0.875rem' }}>
            {artifacts.map((a) => (
              <li key={a.id}>
                <code>{a.kind}</code> — {a.title ?? a.id}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className='mp-codeblock' style={{ maxHeight: 480, overflow: 'auto' }}>
        <pre>{rest}</pre>
      </div>
    </section>
  )
}

function DefRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt style={{ color: 'hsl(var(--muted-foreground))' }}>{k}</dt>
      <dd>{v}</dd>
    </>
  )
}
