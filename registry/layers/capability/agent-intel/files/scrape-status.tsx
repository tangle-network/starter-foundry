'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, X, AlertCircle } from 'lucide-react'

interface ScrapeStatusProps {
  sourceUrl: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  startedAt: string
  entitiesFound: number
  errors: number
  progress?: number
  onCancel: () => void
}

const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  queued: { variant: 'outline', label: 'Queued' },
  running: { variant: 'default', label: 'Running' },
  completed: { variant: 'secondary', label: 'Completed' },
  failed: { variant: 'destructive', label: 'Failed' },
}

export function ScrapeStatus({
  sourceUrl,
  status,
  startedAt,
  entitiesFound,
  errors,
  progress,
  onCancel,
}: ScrapeStatusProps) {
  const config = statusConfig[status]
  const isActive = status === 'queued' || status === 'running'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2 truncate">
          {status === 'running' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
          <span className="truncate text-sm font-medium">{sourceUrl}</span>
        </div>
        <Badge variant={config.variant} className="shrink-0 text-xs">
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent>
        {progress !== undefined ? (
          <Progress value={progress} className="mb-3 h-2" />
        ) : status === 'running' ? (
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        ) : null}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Started {startedAt}</span>
          <span>{entitiesFound} entities</span>
          {errors > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errors} error{errors !== 1 && 's'}
            </span>
          )}
        </div>

        {isActive && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onCancel}>
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
