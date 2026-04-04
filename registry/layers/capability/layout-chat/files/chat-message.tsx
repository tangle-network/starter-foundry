"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  timestamp?: Date
  isStreaming?: boolean
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-2 rounded-lg bg-zinc-950 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-1.5">
        <span className="text-xs text-zinc-400">{lang || "code"}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-200" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{code}</code>
      </pre>
    </div>
  )
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
    parts.push(<CodeBlock key={match.index} lang={match[1]} code={match[2].trimEnd()} />)
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
