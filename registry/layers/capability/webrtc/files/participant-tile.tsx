import * as React from 'react'
import { cn } from '@/lib/utils'
import { Mic, MicOff, VideoOff } from 'lucide-react'

interface ParticipantTileProps {
  name: string
  videoTrack?: MediaStreamTrack
  audioTrack?: MediaStreamTrack
  isMuted: boolean
  isCameraOff: boolean
}

export function ParticipantTile({ name, videoTrack, isMuted, isCameraOff }: ParticipantTileProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    if (videoTrack && videoRef.current) {
      const stream = new MediaStream([videoTrack])
      videoRef.current.srcObject = stream
    }
  }, [videoTrack])

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-900">
      {isCameraOff ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700 text-lg font-semibold text-zinc-300">
            {initials}
          </div>
          <VideoOff className="h-4 w-4 text-zinc-500" />
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className="truncate text-xs font-medium text-white">{name}</span>
        <div className="flex items-center gap-1">
          {!isMuted && (
            <div className="flex items-end gap-px">
              {[12, 16, 10].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 animate-pulse rounded-full bg-emerald-400"
                  style={{ height: `${h}px`, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          )}
          {isMuted ? (
            <MicOff className="h-3.5 w-3.5 text-red-400" />
          ) : (
            <Mic className="h-3.5 w-3.5 text-emerald-400" />
          )}
        </div>
      </div>
    </div>
  )
}
