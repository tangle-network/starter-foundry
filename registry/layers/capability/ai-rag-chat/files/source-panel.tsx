'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { FileText, X, RefreshCw, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

type DocType = 'pdf' | 'url' | 'text' | 'markdown'

interface SourceDocument {
  id: string
  title: string
  type: DocType
  uploadedAt: Date
  content: string
  highlightedPassage?: { start: number; end: number }
  chunks: { id: string; text: string }[]
  activeChunkIndex?: number
}

interface SourcePanelProps {
  document: SourceDocument
  onClose: () => void
  onRemove?: (id: string) => void
  onReindex?: (id: string) => void
}

const typeBadge: Record<DocType, string> = {
  pdf: 'PDF',
  url: 'URL',
  text: 'Text',
  markdown: 'MD',
}

export function SourcePanel({ document: doc, onClose, onRemove, onReindex }: SourcePanelProps) {
  const [chunkIndex, setChunkIndex] = React.useState(doc.activeChunkIndex ?? 0)

  const highlightContent = () => {
    if (!doc.highlightedPassage) return <p className="whitespace-pre-wrap text-sm leading-relaxed">{doc.content}</p>
    const { start, end } = doc.highlightedPassage
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {doc.content.slice(0, start)}
        <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-900">{doc.content.slice(start, end)}</mark>
        {doc.content.slice(end)}
      </p>
    )
  }

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">{doc.title}</p>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">{typeBadge[doc.type]}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {doc.uploadedAt.toLocaleDateString()}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {highlightContent()}
      </ScrollArea>

      {doc.chunks.length > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Chunk {chunkIndex + 1} of {doc.chunks.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={chunkIndex === 0}
              onClick={() => setChunkIndex((i) => i - 1)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={chunkIndex === doc.chunks.length - 1}
              onClick={() => setChunkIndex((i) => i + 1)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Separator />
      <div className="flex items-center gap-2 p-3">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => onReindex?.(doc.id)}>
          <RefreshCw className="h-3 w-3" />
          Re-index
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => onRemove?.(doc.id)}>
          <Trash2 className="h-3 w-3" />
          Remove
        </Button>
      </div>
    </div>
  )
}
