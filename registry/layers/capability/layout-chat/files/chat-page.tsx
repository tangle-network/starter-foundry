"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ChatMessage } from "@/components/chat/chat-message"
import { ChatInput } from "@/components/chat/chat-input"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { Menu, ChevronDown, Settings } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const sampleMessages: Message[] = [
  { id: "1", role: "user", content: "Can you explain how streaming responses work?", timestamp: new Date(Date.now() - 300000) },
  { id: "2", role: "assistant", content: "Streaming responses use Server-Sent Events (SSE) to send data incrementally from server to client. The server writes chunks of the response as they become available, and the client appends each chunk to the display in real-time.\n\nHere's a minimal example:\n\n```typescript\nexport async function POST(req: Request) {\n  const encoder = new TextEncoder()\n  const stream = new ReadableStream({\n    async start(controller) {\n      for (const chunk of chunks) {\n        controller.enqueue(encoder.encode(`data: ${chunk}\\n\\n`))\n      }\n      controller.close()\n    },\n  })\n  return new Response(stream, {\n    headers: { 'Content-Type': 'text/event-stream' },\n  })\n}\n```\n\nThe client reads from this stream and updates the UI as each token arrives.", timestamp: new Date(Date.now() - 240000) },
  { id: "3", role: "user", content: "How do I handle errors during streaming?", timestamp: new Date(Date.now() - 180000) },
  { id: "4", role: "assistant", content: "You have a few options for error handling during streaming:\n\n1. **Send an error event** — Write a special SSE event type that the client recognizes as an error and displays appropriately.\n2. **Close the stream** — If the error is unrecoverable, close the stream and let the client detect the incomplete response.\n3. **Retry logic** — Implement exponential backoff on the client side for transient failures.\n\nThe key is to always surface errors to the user rather than silently failing.", timestamp: new Date(Date.now() - 120000) },
]

const sampleConversations = [
  { id: "conv-1", title: "Streaming responses", lastMessage: "How do I handle errors during streaming?", updatedAt: new Date(Date.now() - 120000) },
  { id: "conv-2", title: "Database migrations", lastMessage: "What's the best migration tool for Postgres?", updatedAt: new Date(Date.now() - 3600000) },
  { id: "conv-3", title: "Auth setup", lastMessage: "How do I add OAuth to Next.js?", updatedAt: new Date(Date.now() - 86400000) },
]

const models = ["GPT-4o", "Claude Sonnet", "Claude Opus", "Llama 3"]

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Message[]>(sampleMessages)
  const [isLoading, setIsLoading] = React.useState(false)
  const [activeConv, setActiveConv] = React.useState("conv-1")
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [model, setModel] = React.useState(models[0])
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSend = (content: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    const streamingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", timestamp: new Date() }
    setMessages((prev) => [...prev, streamingMsg])

    const response = "This is a simulated response. Wire up `/api/chat` to your LLM provider to get real streaming responses."
    let i = 0
    const interval = setInterval(() => {
      i += 3
      if (i >= response.length) {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamingMsg.id ? { ...m, content: response } : m))
        )
        setIsLoading(false)
        clearInterval(interval)
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamingMsg.id ? { ...m, content: response.slice(0, i) } : m))
        )
      }
    }, 30)
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-72 border-r lg:block">
        <ChatSidebar
          conversations={sampleConversations}
          activeId={activeConv}
          onSelect={setActiveConv}
          onNew={() => setMessages([])}
        />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <ChatSidebar
            conversations={sampleConversations}
            activeId={activeConv}
            onSelect={(id) => { setActiveConv(id); setSidebarOpen(false) }}
            onNew={() => { setMessages([]); setSidebarOpen(false) }}
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-1 text-sm font-medium">
                {model}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {models.map((m) => (
                <DropdownMenuItem key={m} onClick={() => setModel(m)}>
                  {m}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </header>

        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="mx-auto max-w-3xl py-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                isStreaming={isLoading && msg === messages[messages.length - 1] && msg.role === "assistant"}
              />
            ))}
          </div>
        </ScrollArea>

        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  )
}
