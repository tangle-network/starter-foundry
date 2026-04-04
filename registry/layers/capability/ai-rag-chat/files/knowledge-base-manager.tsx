'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Upload, Link2, FileText, CheckCircle2, XCircle, Loader2, Database, Layers, Clock } from 'lucide-react'

type IndexStatus = 'indexing' | 'ready' | 'failed'

interface KBDocument {
  id: string
  name: string
  type: string
  chunks: number
  updatedAt: Date
  status: IndexStatus
}

interface KnowledgeBaseManagerProps {
  documents: KBDocument[]
  totalChunks: number
  lastIndexed?: Date
  onUpload?: (files: FileList) => void
  onAddUrl?: (url: string) => void
  onRemove?: (id: string) => void
  onReindex?: (id: string) => void
}

const statusConfig: Record<IndexStatus, { icon: React.ElementType; label: string; className: string }> = {
  indexing: { icon: Loader2, label: 'Indexing', className: 'text-blue-500' },
  ready: { icon: CheckCircle2, label: 'Ready', className: 'text-green-500' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-red-500' },
}

export function KnowledgeBaseManager({
  documents,
  totalChunks,
  lastIndexed,
  onUpload,
  onAddUrl,
  onRemove,
  onReindex,
}: KnowledgeBaseManagerProps) {
  const [url, setUrl] = React.useState('')
  const [dragOver, setDragOver] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) onUpload?.(e.dataTransfer.files)
  }

  const handleAddUrl = () => {
    if (!url.trim()) return
    onAddUrl?.(url.trim())
    setUrl('')
  }

  const indexingCount = documents.filter((d) => d.status === 'indexing').length
  const indexingProgress = documents.length > 0 ? ((documents.length - indexingCount) / documents.length) * 100 : 100

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{documents.length} documents</span>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{totalChunks} chunks</span>
        </div>
        {lastIndexed && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Last indexed {lastIndexed.toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {indexingCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Indexing {indexingCount} document{indexingCount !== 1 && 's'}...</span>
            <span>{indexingProgress.toFixed(0)}%</span>
          </div>
          <Progress value={indexingProgress} className="h-1.5" />
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Drop files here or click to upload</p>
          <p className="text-xs text-muted-foreground">PDF, TXT, MD, HTML</p>
        </div>
        <input ref={fileRef} type="file" className="hidden" multiple accept=".pdf,.txt,.md,.html" onChange={(e) => e.target.files && onUpload?.(e.target.files)} />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/docs"
            className="pl-9"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl() }}
          />
        </div>
        <Button variant="outline" onClick={handleAddUrl} disabled={!url.trim()}>
          Add URL
        </Button>
      </div>

      {documents.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-20">Chunks</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const StatusIcon = statusConfig[doc.status].icon
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{doc.type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.chunks}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={cn('h-3.5 w-3.5', statusConfig[doc.status].className, doc.status === 'indexing' && 'animate-spin')} />
                        <span className="text-xs">{statusConfig[doc.status].label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => doc.status === 'failed' ? onReindex?.(doc.id) : onRemove?.(doc.id)}>
                        {doc.status === 'failed' ? 'Retry' : 'Remove'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
