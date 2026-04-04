'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ParticipantTile } from './participant-tile'

interface Participant {
  id: string
  name: string
  videoTrack?: MediaStreamTrack
  audioTrack?: MediaStreamTrack
  isLocal: boolean
}

interface VideoRoomProps {
  participants: Participant[]
  onLeave: () => void
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

const statusStyles: Record<ConnectionStatus, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
  connecting: { variant: 'secondary', label: 'Connecting...' },
  connected: { variant: 'default', label: 'Connected' },
  disconnected: { variant: 'destructive', label: 'Disconnected' },
}

function gridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count <= 4) return 'grid-cols-2'
  if (count <= 9) return 'grid-cols-3'
  return 'grid-cols-4'
}

export function VideoRoom({ participants, onLeave }: VideoRoomProps) {
  const [status, setStatus] = React.useState<ConnectionStatus>('connecting')

  React.useEffect(() => {
    const timer = setTimeout(() => setStatus('connected'), 1500)
    return () => clearTimeout(timer)
  }, [])

  const remoteParticipants = participants.filter((p) => !p.isLocal)
  const localParticipant = participants.find((p) => p.isLocal)

  const { variant, label } = statusStyles[status]

  return (
    <div className="relative flex h-full flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-2">
        <Badge variant={variant} className="text-xs">
          {label}
        </Badge>
        <span className="text-xs text-zinc-400">
          {participants.length} participant{participants.length !== 1 && 's'}
        </span>
      </div>

      <div
        className={cn(
          'grid flex-1 gap-2 p-2',
          gridCols(remoteParticipants.length || 1)
        )}
      >
        {remoteParticipants.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-700 text-zinc-500">
            <p className="text-sm">Waiting for others to join...</p>
          </div>
        ) : (
          remoteParticipants.map((p) => (
            <ParticipantTile
              key={p.id}
              name={p.name}
              videoTrack={p.videoTrack}
              audioTrack={p.audioTrack}
              isMuted={!p.audioTrack}
              isCameraOff={!p.videoTrack}
            />
          ))
        )}
      </div>

      {localParticipant && (
        <div className="absolute bottom-4 right-4 h-36 w-48 overflow-hidden rounded-lg border-2 border-zinc-700 shadow-lg">
          <ParticipantTile
            name={localParticipant.name}
            videoTrack={localParticipant.videoTrack}
            audioTrack={localParticipant.audioTrack}
            isMuted={!localParticipant.audioTrack}
            isCameraOff={!localParticipant.videoTrack}
          />
        </div>
      )}
    </div>
  )
}
