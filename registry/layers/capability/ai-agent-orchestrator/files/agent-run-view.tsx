'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Bot, Wrench, Clock, CheckCircle2, XCircle, ChevronDown, Brain, Loader2 } from 'lucide-react'

type StepStatus = 'running' | 'completed' | 'failed' | 'waiting'
type StepType = 'action' | 'thinking' | 'tool_call'

interface ToolCall {
  name: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
}

interface RunStep {
  id: string
  agentName: string
  agentRole?: string
  type: StepType
  description: string
  toolCall?: ToolCall
  output?: string
  status: StepStatus
  durationMs?: number
}

interface AgentRunViewProps {
  steps: RunStep[]
  totalDurationMs?: number
}

const statusConfig: Record<StepStatus, { icon: React.ElementType; className: string }> = {
  running: { icon: Loader2, className: 'text-blue-500 animate-spin' },
  completed: { icon: CheckCircle2, className: 'text-green-500' },
  failed: { icon: XCircle, className: 'text-red-500' },
  waiting: { icon: Clock, className: 'text-yellow-500' },
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StepItem({ step }: { step: RunStep }) {
  const [open, setOpen] = React.useState(false)
  const StatusIcon = statusConfig[step.status].icon
  const isThinking = step.type === 'thinking'

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background')}>
          {isThinking ? (
            <Brain className="h-3.5 w-3.5 text-purple-500" />
          ) : step.type === 'tool_call' ? (
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      <div className="flex-1 space-y-1.5 pt-0.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{step.agentName}</Badge>
          {step.agentRole && <span className="text-xs text-muted-foreground">{step.agentRole}</span>}
          <div className="flex-1" />
          <StatusIcon className={cn('h-4 w-4', statusConfig[step.status].className)} />
          {step.durationMs != null && (
            <span className="text-[11px] text-muted-foreground">{formatDuration(step.durationMs)}</span>
          )}
        </div>

        <p className={cn('text-sm', isThinking && 'italic text-muted-foreground')}>{step.description}</p>

        {step.toolCall && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
                <Wrench className="h-3 w-3" />
                {step.toolCall.name}
                <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-1.5 space-y-2 p-3">
                <div>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Input</p>
                  <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(step.toolCall.input, null, 2)}</pre>
                </div>
                {step.toolCall.output && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Output</p>
                    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(step.toolCall.output, null, 2)}</pre>
                  </div>
                )}
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {step.output && !step.toolCall && (
          <Card className="mt-1 p-3">
            <p className="text-xs text-muted-foreground">{step.output}</p>
          </Card>
        )}
      </div>
    </div>
  )
}

export function AgentRunView({ steps, totalDurationMs }: AgentRunViewProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-0 p-4">
        {steps.map((step) => (
          <StepItem key={step.id} step={step} />
        ))}
      </div>
      {totalDurationMs != null && (
        <>
          <Separator />
          <div className="flex items-center justify-end gap-1.5 px-4 py-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total: {formatDuration(totalDurationMs)}</span>
          </div>
        </>
      )}
    </ScrollArea>
  )
}
