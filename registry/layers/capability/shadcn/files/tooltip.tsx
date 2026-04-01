import * as React from "react"
import { cn } from "@/lib/utils"

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

type TooltipContextValue = { open: boolean; onOpenChange: (v: boolean) => void }
const TooltipContext = React.createContext<TooltipContextValue>({ open: false, onOpenChange: () => {} })

function Tooltip({ open: controlledOpen, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(false)
  const open = controlledOpen ?? internal
  const setter = onOpenChange ?? setInternal
  return <TooltipContext.Provider value={{ open, onOpenChange: setter }}>{children}</TooltipContext.Provider>
}

const TooltipTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onMouseEnter, onMouseLeave, ...props }, ref) => {
    const ctx = React.useContext(TooltipContext)
    return (
      <button ref={ref} type="button"
        onMouseEnter={(e) => { ctx.onOpenChange(true); onMouseEnter?.(e) }}
        onMouseLeave={(e) => { ctx.onOpenChange(false); onMouseLeave?.(e) }}
        onFocus={() => ctx.onOpenChange(true)}
        onBlur={() => ctx.onOpenChange(false)}
        {...props}
      />
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const ctx = React.useContext(TooltipContext)
    if (!ctx.open) return null
    return (
      <div ref={ref} className={cn("z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95", className)} {...props} />
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
