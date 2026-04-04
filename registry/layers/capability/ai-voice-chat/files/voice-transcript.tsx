'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Bot, Volume2, Loader2 } from 'lucide-react'

interface Utterance {
  id: string
  speaker: 'user' | 'ai'
  text: string
  timestamp: Date
  confidence?: number
}

interface VoiceTranscriptProps {
  utterances: Utterance[]
  activeId?: string
  onReplay?: (id: string) => void
}

export function VoiceTranscript({ utterances, activeId, onReplay }: VoiceTranscriptProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [utterances])

  return (
    <div className="space-y-3 p-4">
      {utterances.map((u) => {
        const isActive = u.id === activeId
        const isAI = u.speaker === 'ai'
        const Icon = isAI ? Bot : User

        return (
          <div key={u.id} className="flex items-start gap-2.5">
            <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', isAI ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{isAI ? 'AI' : 'You'}</span>
                <span className="text-[10px] text-muted-foreground">
                  {u.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {u.confidence != null && u.confidence < 1 && (
                  <Badge variant="outline" className="text-[9px]">{(u.confidence * 100).toFixed(0)}%</Badge>
                )}
              </div>
              <p className={cn('text-sm', isActive && 'text-muted-foreground')}>
                {u.text}
                {isActive && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
              </p>
            </div>
            {isAI && onReplay && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onReplay(u.id)}>
                <Volume2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
