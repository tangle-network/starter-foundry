import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

type ToastData = { id: string; title?: string; description?: string; variant?: "default" | "destructive"; action?: React.ReactNode }

let listeners: Array<(t: ToastData) => void> = []
let toastCount = 0

function toast(opts: Omit<ToastData, "id">) {
  const t = { ...opts, id: String(++toastCount) }
  listeners.forEach((fn) => fn(t))
  return t.id
}

function ToastAction({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn("inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring", className)} {...props} />
  )
}

function Toaster() {
  const [toasts, setToasts] = React.useState<ToastData[]>([])

  React.useEffect(() => {
    const handler = (t: ToastData) => {
      setToasts((prev) => [...prev, t])
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 5000)
    }
    listeners.push(handler)
    return () => { listeners = listeners.filter((fn) => fn !== handler) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-[420px]">
      {toasts.map((t) => (
        <div key={t.id} className={cn(toastVariants({ variant: t.variant }), "mb-2")}>
          <div className="grid gap-1">
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            {t.description && <div className="text-sm opacity-90">{t.description}</div>}
          </div>
          {t.action}
          <button className="absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
            <span className="text-xs">✕</span>
          </button>
        </div>
      ))}
    </div>
  )
}

export { toast, Toaster, ToastAction, toastVariants }
