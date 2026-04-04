'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot, Loader2 } from 'lucide-react'

type AgentStatus = 'idle' | 'running' | 'waiting' | 'errored'

interface Agent {
  id: string
  name: string
  role: string
  model: string
  tools: string[]
  status: AgentStatus
  messagesSent: number
  messagesReceived: number
  lastAction?: string
}

interface AgentCardProps {
  agent: Agent
  isActive?: boolean
  onClick?: () => void
}

const statusColors: Record<AgentStatus, string> = {
  idle: 'bg-zinc-400',
  running: 'bg-green-500',
  waiting: 'bg-yellow-500',
  errored: 'bg-red-500',
}

export function AgentCard({ agent, isActive, onClick }: AgentCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'cursor-pointer space-y-3 p-4 transition-colors hover:bg-accent/50',
        isActive && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            {agent.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{agent.name}</p>
            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusColors[agent.status])} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">{agent.model}</Badge>
      </div>

      {agent.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.tools.map((tool) => (
            <Badge key={tool} variant="outline" className="text-[10px]">{tool}</Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{agent.messagesSent} sent / {agent.messagesReceived} received</span>
      </div>

      {agent.lastAction && (
        <p className="truncate text-xs text-muted-foreground">{agent.lastAction}</p>
      )}
    </Card>
  )
}
