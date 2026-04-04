'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VoiceTranscript } from '@/components/voice/voice-transcript'
import { VoiceControls } from '@/components/voice/voice-controls'
import { Mic, Settings } from 'lucide-react'

type VoiceStatus = 'ready' | 'listening' | 'thinking' | 'speaking'

const statusLabels: Record<VoiceStatus, string> = {
  ready: 'Ready',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
}

const sampleTranscript = [
  { id: '1', speaker: 'user' as const, text: 'What is the weather like today?', timestamp: new Date(Date.now() - 30000), confidence: 0.97 },
  { id: '2', speaker: 'ai' as const, text: "Based on your location, it's currently 72 degrees and sunny with light winds. Perfect weather for being outside!", timestamp: new Date(Date.now() - 25000), confidence: 1 },
  { id: '3', speaker: 'user' as const, text: 'Should I bring an umbrella?', timestamp: new Date(Date.now() - 10000), confidence: 0.94 },
]

const suggestions = ['Tell me a joke', 'What time is it?', 'Set a timer for 5 minutes', 'Summarize my last meeting']

export default function VoiceChatPage() {
  const [status, setStatus] = React.useState<VoiceStatus>('ready')
  const [isMuted, setIsMuted] = React.useState(false)
  const [voice, setVoice] = React.useState('alloy')
  const [showSettings, setShowSettings] = React.useState(false)

  const isActive = status !== 'ready'

  const handleMicToggle = () => {
    if (status === 'ready') setStatus('listening')
    else setStatus('ready')
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold">Voice Chat</h1>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="h-4 w-4" />
        </Button>
      </header>

      {showSettings && (
        <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Voice</label>
            <Select value={voice} onValueChange={setVoice}>
              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alloy">Alloy</SelectItem>
                <SelectItem value="echo">Echo</SelectItem>
                <SelectItem value="fable">Fable</SelectItem>
                <SelectItem value="onyx">Onyx</SelectItem>
                <SelectItem value="nova">Nova</SelectItem>
                <SelectItem value="shimmer">Shimmer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Language</label>
            <Select defaultValue="en">
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Speed</label>
            <Select defaultValue="1.0">
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1.0">1.0x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
        <div className="relative flex items-center justify-center">
          <div
            className={cn(
              'absolute h-32 w-32 rounded-full transition-all duration-700',
              status === 'speaking' && 'animate-pulse bg-primary/20 scale-125',
              status === 'listening' && 'animate-pulse bg-blue-500/20 scale-110',
              status === 'thinking' && 'bg-yellow-500/10 scale-105',
            )}
          />
          <div
            className={cn(
              'absolute h-24 w-24 rounded-full transition-all duration-500',
              status === 'speaking' && 'animate-pulse bg-primary/30 scale-110 [animation-delay:150ms]',
              status === 'listening' && 'animate-pulse bg-blue-500/25 scale-105 [animation-delay:150ms]',
            )}
          />
          <button
            onClick={handleMicToggle}
            className={cn(
              'relative z-10 flex h-20 w-20 items-center justify-center rounded-full transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground'
            )}
          >
            <Mic className="h-8 w-8" />
          </button>
        </div>

        <Badge variant="secondary" className="text-sm">
          {statusLabels[status]}
        </Badge>
      </div>

      <div className="border-t">
        <ScrollArea className="h-48">
          <VoiceTranscript utterances={sampleTranscript} activeId={isActive ? '3' : undefined} />
        </ScrollArea>
      </div>

      <div className="flex flex-wrap justify-center gap-2 border-t px-4 py-3">
        {suggestions.map((s) => (
          <Button key={s} variant="outline" size="sm" className="text-xs">
            {s}
          </Button>
        ))}
      </div>

      <VoiceControls
        isActive={isActive}
        isMuted={isMuted}
        onMicToggle={handleMicToggle}
        onMuteToggle={() => setIsMuted(!isMuted)}
        onEndCall={() => setStatus('ready')}
        audioLevel={isActive ? 0.6 : 0}
      />
    </div>
  )
}
