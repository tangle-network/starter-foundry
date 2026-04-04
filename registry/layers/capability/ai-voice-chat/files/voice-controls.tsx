'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Mic, MicOff, PhoneOff, Wifi, WifiOff } from 'lucide-react'

interface VoiceControlsProps {
  isActive: boolean
  isMuted: boolean
  onMicToggle: () => void
  onMuteToggle: () => void
  onEndCall: () => void
  audioLevel?: number
  connected?: boolean
}

function AudioBars({ level }: { level: number }) {
  const bars = [0.3, 0.6, 1.0, 0.7, 0.4]
  return (
    <div className="flex items-end gap-0.5 h-4">
      {bars.map((threshold, i) => (
        <div
          key={i}
          className={cn(
            'w-0.5 rounded-full transition-all duration-150',
            level >= threshold ? 'bg-green-500' : 'bg-muted-foreground/20'
          )}
          style={{ height: `${Math.max(4, threshold * 16)}px` }}
        />
      ))}
    </div>
  )
}

export function VoiceControls({
  isActive,
  isMuted,
  onMicToggle,
  onMuteToggle,
  onEndCall,
  audioLevel = 0,
  connected = true,
}: VoiceControlsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-4 border-t bg-background px-4 py-3">
        {isActive && <AudioBars level={audioLevel} />}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', isMuted && 'text-red-500')}
              onClick={onMuteToggle}
              disabled={!isActive}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className={cn(
                'h-12 w-12 rounded-full',
                isActive
                  ? 'bg-primary text-primary-foreground ring-2 ring-red-500 ring-offset-2 ring-offset-background'
                  : 'bg-primary text-primary-foreground'
              )}
              onClick={onMicToggle}
            >
              <Mic className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isActive ? 'Stop' : 'Start'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={onEndCall}
              disabled={!isActive}
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>End call</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {connected ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>{connected ? 'Connected' : 'Disconnected'}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
