'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Folder, FolderPlus, ChevronRight, Star, Archive, MessageSquare } from 'lucide-react'

interface ChatFolder {
  id: string
  name: string
  icon?: 'all' | 'starred' | 'archived' | 'custom'
  count: number
}

interface SessionFoldersProps {
  folders: ChatFolder[]
  activeId?: string
  onSelect: (id: string) => void
  onCreate?: () => void
  onRename?: (id: string) => void
  onDelete?: (id: string) => void
}

const folderIcons = {
  all: MessageSquare,
  starred: Star,
  archived: Archive,
  custom: Folder,
}

function FolderItem({
  folder,
  isActive,
  onSelect,
}: {
  folder: ChatFolder
  isActive: boolean
  onSelect: () => void
}) {
  const Icon = folderIcons[folder.icon ?? 'custom']

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        'hover:bg-accent',
        isActive && 'bg-accent font-medium'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{folder.name}</span>
      <Badge variant="secondary" className="h-5 min-w-[20px] justify-center px-1.5 text-[10px]">
        {folder.count}
      </Badge>
    </button>
  )
}

export function SessionFolders({ folders, activeId, onSelect, onCreate }: SessionFoldersProps) {
  const [open, setOpen] = React.useState(true)

  const defaultFolders = folders.filter((f) => f.icon && f.icon !== 'custom')
  const customFolders = folders.filter((f) => !f.icon || f.icon === 'custom')

  return (
    <div className="space-y-1 p-2">
      {defaultFolders.map((f) => (
        <FolderItem key={f.id} folder={f} isActive={activeId === f.id} onSelect={() => onSelect(f.id)} />
      ))}

      {customFolders.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen} className="pt-2">
          <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
            Folders
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5 pt-1">
            {customFolders.map((f) => (
              <FolderItem key={f.id} folder={f} isActive={activeId === f.id} onSelect={() => onSelect(f.id)} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <Button variant="ghost" size="sm" className="mt-1 w-full justify-start gap-2 text-muted-foreground" onClick={onCreate}>
        <FolderPlus className="h-3.5 w-3.5" />
        New folder
      </Button>
    </div>
  )
}
