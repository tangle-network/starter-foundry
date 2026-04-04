'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AgentRunView } from '@/components/agents/agent-run-view'
import { AgentCard } from '@/components/agents/agent-card'
import { Play, Settings2 } from 'lucide-react'

const sampleAgents = [
  { id: 'a1', name: 'Researcher', role: 'Finds relevant information', model: 'GPT-4o', tools: ['web_search', 'scrape'], status: 'completed' as const, messagesSent: 3, messagesReceived: 2, lastAction: 'Searched for "AI agent frameworks"' },
  { id: 'a2', name: 'Analyst', role: 'Synthesizes findings into insights', model: 'Claude Sonnet', tools: ['code_exec', 'chart'], status: 'running' as const, messagesSent: 1, messagesReceived: 3, lastAction: 'Analyzing search results...' },
  { id: 'a3', name: 'Writer', role: 'Produces final report', model: 'Claude Opus', tools: ['markdown'], status: 'idle' as const, messagesSent: 0, messagesReceived: 0 },
]

const sampleSteps = [
  { id: 's1', agentName: 'Researcher', agentRole: 'Research', type: 'action' as const, description: 'Starting web search for AI agent frameworks', status: 'completed' as const, durationMs: 1200 },
  { id: 's2', agentName: 'Researcher', type: 'tool_call' as const, description: 'Called web_search', status: 'completed' as const, durationMs: 3400, toolCall: { name: 'web_search', input: { query: 'best AI agent frameworks 2025' }, output: { results: 8 } } },
  { id: 's3', agentName: 'Researcher', type: 'thinking' as const, description: 'Evaluating which results are most relevant for a technical comparison...', status: 'completed' as const, durationMs: 800 },
  { id: 's4', agentName: 'Analyst', type: 'action' as const, description: 'Received research results, beginning analysis', status: 'running' as const },
]

type RunStatus = 'idle' | 'running' | 'completed' | 'failed'

const statusBadgeVariant: Record<RunStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  idle: 'secondary',
  running: 'default',
  completed: 'outline',
  failed: 'destructive',
}

export default function OrchestratorPage() {
  const [task, setTask] = React.useState('')
  const [runStatus, setRunStatus] = React.useState<RunStatus>('running')
  const [selectedAgent, setSelectedAgent] = React.useState<string | null>(null)
  const [model, setModel] = React.useState('gpt-4o')
  const [maxIterations, setMaxIterations] = React.useState('10')
  const [showConfig, setShowConfig] = React.useState(false)

  const handleRun = () => {
    if (!task.trim()) return
    setRunStatus('running')
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 items-center gap-3 border-b px-4">
        <h1 className="text-sm font-semibold">Agent Orchestrator</h1>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-muted-foreground">Research Task</span>
        <Badge variant={statusBadgeVariant[runStatus]} className="text-[10px]">{runStatus}</Badge>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowConfig(!showConfig)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </header>

      {showConfig && (
        <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Model</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="claude-sonnet">Claude Sonnet</SelectItem>
                <SelectItem value="claude-opus">Claude Opus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Max iterations</label>
            <Input value={maxIterations} onChange={(e) => setMaxIterations(e.target.value)} className="h-7 w-16 text-xs" type="number" min="1" max="100" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Timeout</label>
            <Input defaultValue="300" className="h-7 w-16 text-xs" type="number" min="10" />
            <span className="text-xs text-muted-foreground">sec</span>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-y-auto border-r p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Agents</p>
          <div className="space-y-2">
            {sampleAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isActive={selectedAgent === agent.id}
                onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
              />
            ))}
          </div>
        </aside>

        <div className="flex-1 overflow-hidden">
          <AgentRunView steps={sampleSteps} totalDurationMs={5400} />
        </div>
      </div>

      <div className="border-t p-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe the task for your agents..."
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleRun() }}
          />
          <Button onClick={handleRun} disabled={!task.trim() || runStatus === 'running'} className="gap-1.5">
            <Play className="h-4 w-4" />
            Run
          </Button>
        </div>
      </div>
    </div>
  )
}
