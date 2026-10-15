"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { CodeBlock, CopyButton } from "@tangle-network/ui/markdown"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  timestamp?: Date
  isStreaming?: boolean
}

function StreamingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
    </div>
  )
}

function parseContent(content: string) {
  const parts: React.ReactNode[] = []
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex} className="whitespace-pre-wrap">{content.slice(lastIndex, match.index)}</span>)
    }
    parts.push(<CodeBlock key={match.index} language={match[1]} code={match[2].trimEnd()}><CopyButton text={match[2].trimEnd()} /></CodeBlock>)
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push(<span key={lastIndex} className="whitespace-pre-wrap">{content.slice(lastIndex)}</span>)
  }

  return parts
}

export function ChatMessage({ role, content, timestamp, isStreaming }: ChatMessageProps) {
  const isUser = role === "user"

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <Avatar className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          AI
        </Avatar>
      )}
      <div className={cn("max-w-[75%] space-y-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {isStreaming && !content ? <StreamingDots /> : parseContent(content)}
        </div>
        {timestamp && (
          <p className={cn("px-1 text-[11px] text-muted-foreground", isUser && "text-right")}>
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  )
}
