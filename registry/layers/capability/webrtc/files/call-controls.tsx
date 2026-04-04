'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, PhoneOff } from 'lucide-react'

interface CallControlsProps {
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onShareScreen: () => void
  onToggleChat: () => void
  onLeave: () => void
}

const controls = (props: CallControlsProps) => [
  {
    icon: props.isMuted ? MicOff : Mic,
    label: props.isMuted ? 'Unmute' : 'Mute',
    onClick: props.onToggleMic,
    active: !props.isMuted,
    destructive: false,
  },
  {
    icon: props.isCameraOff ? VideoOff : Video,
    label: props.isCameraOff ? 'Turn on camera' : 'Turn off camera',
    onClick: props.onToggleCamera,
    active: !props.isCameraOff,
    destructive: false,
  },
  {
    icon: Monitor,
    label: props.isScreenSharing ? 'Stop sharing' : 'Share screen',
    onClick: props.onShareScreen,
    active: props.isScreenSharing,
    destructive: false,
  },
  {
    icon: MessageSquare,
    label: 'Chat',
    onClick: props.onToggleChat,
    active: false,
    destructive: false,
  },
  {
    icon: PhoneOff,
    label: 'Leave call',
    onClick: props.onLeave,
    active: false,
    destructive: true,
  },
]

export function CallControls(props: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
      <TooltipProvider delayDuration={0}>
        {controls(props).map((ctrl) => (
          <Tooltip key={ctrl.label}>
            <TooltipTrigger asChild>
              <Button
                variant={ctrl.destructive ? 'destructive' : ctrl.active ? 'secondary' : 'outline'}
                size="icon"
                className={cn(
                  'h-10 w-10 rounded-full',
                  !ctrl.destructive && !ctrl.active && 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                )}
                onClick={ctrl.onClick}
              >
                <ctrl.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{ctrl.label}</TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  )
}
