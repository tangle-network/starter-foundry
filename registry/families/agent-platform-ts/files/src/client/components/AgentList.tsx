import { Link } from 'react-router-dom'
import type { AgentSummary } from '../../shared/schema'

export interface AgentListProps {
  agents: AgentSummary[]
}

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <p>
        No agent packs are loaded. Add one under <code>./agents/&lt;id&gt;/</code> with a{' '}
        <code>system-prompt.md</code> and <code>methodology/index.json</code>, register it in{' '}
        <code>src/worker/lib/load-agent-pack.ts</code>, then redeploy.
      </p>
    )
  }
  return (
    <div className='agent-list'>
      {agents.map((a) => (
        <Link key={a.id} to={`/agents/${encodeURIComponent(a.id)}`} className='agent-card-link'>
          <div className='agent-card'>
            <h3>{a.name}</h3>
            <p>{a.description || 'No description.'}</p>
            {a.tags.length > 0 ? (
              <div className='tags'>
                {a.tags.map((t) => (
                  <span key={t} className='tag'>
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  )
}
