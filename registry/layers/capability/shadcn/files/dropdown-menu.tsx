import * as React from "react"
import { cn } from "@/lib/utils"

type DropdownContextValue = { open: boolean; onOpenChange: (v: boolean) => void }
const DropdownContext = React.createContext<DropdownContextValue>({ open: false, onOpenChange: () => {} })

function DropdownMenu({ open: controlledOpen, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(false)
  const open = controlledOpen ?? internal
  const setter = onOpenChange ?? setInternal
  return <DropdownContext.Provider value={{ open, onOpenChange: setter }}>{children}</DropdownContext.Provider>
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const ctx = React.useContext(DropdownContext)
    return <button ref={ref} type="button" onClick={(e) => { ctx.onOpenChange(!ctx.open); onClick?.(e) }} {...props} />
  }
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const ctx = React.useContext(DropdownContext)
    const contentRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
      if (!ctx.open) return
      const handler = (e: MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) ctx.onOpenChange(false)
      }
      document.addEventListener("mousedown", handler)
      return () => document.removeEventListener("mousedown", handler)
    }, [ctx.open, ctx.onOpenChange])
    if (!ctx.open) return null
    return (
      <div ref={(node) => { (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node }}
        className={cn("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)} {...props}
      />
    )
  }
)
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(
  ({ className, inset, onClick, ...props }, ref) => {
    const ctx = React.useContext(DropdownContext)
    return (
      <div ref={ref} role="menuitem" className={cn("relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground", inset && "pl-8", className)}
        onClick={(e) => { onClick?.(e); ctx.onOpenChange(false) }} {...props}
      />
    )
  }
)
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
  )
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel }
