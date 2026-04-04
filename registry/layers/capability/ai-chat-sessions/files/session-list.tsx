'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, Pin, Pencil, Archive, Trash2, MessageSquare } from 'lucide-react'

interface Session {
  id: string
  title: string
  lastMessage: string
  updatedAt: Date
  pinned?: boolean
  archived?: boolean
}

interface SessionListProps {
  sessions: Session[]
  activeId?: string
  onSelect: (id: string) => void
  onNew: () => void
  onRename?: (id: string) => void
  onPin?: (id: string) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

function groupSessions(sessions: Session[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOf7Days = new Date(startOfToday.getTime() - 7 * 86400000)

  const pinned: Session[] = []
  const today: Session[] = []
  const yesterday: Session[] = []
  const previous7: Session[] = []
  const older: Session[] = []

  for (const s of sessions) {
    if (s.archived) continue
    if (s.pinned) { pinned.push(s); continue }
    const t = s.updatedAt.getTime()
    if (t >= startOfToday.getTime()) today.push(s)
    else if (t >= startOfYesterday.getTime()) yesterday.push(s)
    else if (t >= startOf7Days.getTime()) previous7.push(s)
    else older.push(s)
  }

  return { pinned, today, yesterday, previous7, older }
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  session: Session
  isActive: boolean
  onSelect: () => void
  onRename?: () => void
  onPin?: () => void
  onArchive?: () => void
  onDelete?: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-accent',
        isActive && 'bg-accent'
      )}
    >
      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium">{session.title}</p>
        <p className="truncate text-xs text-muted-foreground">{session.lastMessage}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPin}>
            <Pin className="mr-2 h-3.5 w-3.5" /> {session.pinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="mr-2 h-3.5 w-3.5" /> Archive
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function GroupLabel({ label }: { label: string }) {
  return <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">{label}</p>
}

export function SessionList({ sessions, activeId, onSelect, onNew, onRename, onPin, onArchive, onDelete }: SessionListProps) {
  const [query, setQuery] = React.useState('')

  const filtered = query
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()) || s.lastMessage.toLowerCase().includes(query.toLowerCase()))
    : sessions

  const groups = groupSessions(filtered)

  const renderGroup = (label: string, items: Session[]) =>
    items.length > 0 && (
      <div key={label}>
        <GroupLabel label={label} />
        {items.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={activeId === s.id}
            onSelect={() => onSelect(s.id)}
            onRename={() => onRename?.(s.id)}
            onPin={() => onPin?.(s.id)}
            onArchive={() => onArchive?.(s.id)}
            onDelete={() => onDelete?.(s.id)}
          />
        ))}
      </div>
    )

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b px-3">
        <span className="text-sm font-semibold">Chats</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNew}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {renderGroup('Pinned', groups.pinned)}
          {renderGroup('Today', groups.today)}
          {renderGroup('Yesterday', groups.yesterday)}
          {renderGroup('Previous 7 Days', groups.previous7)}
          {renderGroup('Older', groups.older)}
        </div>
      </ScrollArea>

      <Separator />
      <div className="p-3">
        <p className="text-center text-xs text-muted-foreground">
          {filtered.length} conversation{filtered.length !== 1 && 's'}
        </p>
      </div>
    </div>
  )
}
