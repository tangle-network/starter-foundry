'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ChevronDown, Share2, Settings2 } from 'lucide-react'

interface ChatHeaderProps {
  title: string
  model: string
  models: string[]
  onTitleChange?: (title: string) => void
  onModelChange?: (model: string) => void
  onShare?: () => void
}

export function ChatHeader({ title, model, models, onTitleChange, onModelChange, onShare }: ChatHeaderProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(title)
  const [systemPrompt, setSystemPrompt] = React.useState('')
  const [temperature, setTemperature] = React.useState('0.7')

  const commitTitle = () => {
    setEditing(false)
    if (draft.trim() && draft !== title) onTitleChange?.(draft.trim())
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      {editing ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setDraft(title); setEditing(false) } }}
          className="h-8 max-w-xs text-sm font-medium"
          autoFocus
        />
      ) : (
        <button onClick={() => { setDraft(title); setEditing(true) }} className="truncate text-sm font-medium hover:underline">
          {title}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="ml-1 gap-1 text-xs text-muted-foreground">
            {model}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {models.map((m) => (
            <DropdownMenuItem key={m} onClick={() => onModelChange?.(m)}>{m}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="end">
          <div className="space-y-1">
            <label className="text-xs font-medium">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={3}
              className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Temperature</label>
            <Input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShare}>
        <Share2 className="h-4 w-4" />
      </Button>
    </header>
  )
}
