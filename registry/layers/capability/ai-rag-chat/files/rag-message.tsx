'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { FileText, ExternalLink, ChevronDown, BookOpen, Star } from 'lucide-react'

type Confidence = 'high' | 'medium' | 'low'

interface Source {
  id: string
  title: string
  relevanceScore: number
  pageRef?: string
  chunkRef?: string
  snippet: string
}

interface RagMessageProps {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence?: Confidence
  timestamp?: Date
  onSourceClick?: (sourceId: string) => void
}

const confidenceConfig: Record<Confidence, { label: string; className: string }> = {
  high: { label: 'High confidence', className: 'bg-green-500' },
  medium: { label: 'Medium confidence', className: 'bg-yellow-500' },
  low: { label: 'Low confidence', className: 'bg-red-500' },
}

function SourceItem({ source, onClick }: { source: Source; onClick?: () => void }) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
      >
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-xs font-medium">{source.title}</p>
          <div className="flex items-center gap-1.5">
            {source.pageRef && <span className="text-[10px] text-muted-foreground">{source.pageRef}</span>}
            {source.chunkRef && <span className="text-[10px] text-muted-foreground">Chunk {source.chunkRef}</span>}
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          <Star className="mr-0.5 h-2.5 w-2.5" />
          {(source.relevanceScore * 100).toFixed(0)}%
        </Badge>
      </button>
      {expanded && (
        <div className="ml-6 space-y-1.5">
          <p className="text-xs text-muted-foreground leading-relaxed">{source.snippet}</p>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={onClick}>
            <ExternalLink className="h-3 w-3" />
            View full source
          </Button>
        </div>
      )}
    </div>
  )
}

export function RagMessage({ role, content, sources, confidence, timestamp, onSourceClick }: RagMessageProps) {
  const [sourcesOpen, setSourcesOpen] = React.useState(false)
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-3 px-4 py-3', isUser && 'flex-row-reverse')}>
      <div className={cn('max-w-[80%] space-y-2', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          <span className="whitespace-pre-wrap">{content}</span>
        </div>

        {!isUser && confidence && (
          <div className="flex items-center gap-1.5 px-1">
            <span className={cn('h-2 w-2 rounded-full', confidenceConfig[confidence].className)} />
            <span className="text-[11px] text-muted-foreground">{confidenceConfig[confidence].label}</span>
          </div>
        )}

        {!isUser && sources && sources.length > 0 && (
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                {sources.length} source{sources.length !== 1 && 's'}
                <ChevronDown className={cn('h-3 w-3 transition-transform', sourcesOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-1 space-y-1 p-2">
                {sources.map((source, i) => (
                  <React.Fragment key={source.id}>
                    {i > 0 && <Separator className="my-1" />}
                    <SourceItem source={source} onClick={() => onSourceClick?.(source.id)} />
                  </React.Fragment>
                ))}
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {timestamp && (
          <p className={cn('px-1 text-[11px] text-muted-foreground', isUser && 'text-right')}>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}
