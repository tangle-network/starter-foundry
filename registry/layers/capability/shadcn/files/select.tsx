import * as React from "react"
import { cn } from "@/lib/utils"

type SelectContextValue = { value: string; onValueChange: (v: string) => void; open: boolean; onOpenChange: (v: boolean) => void }
const SelectContext = React.createContext<SelectContextValue>({ value: "", onValueChange: () => {}, open: false, onOpenChange: () => {} })

function Select({ value: controlledValue, onValueChange, defaultValue = "", children }: { value?: string; onValueChange?: (v: string) => void; defaultValue?: string; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const value = controlledValue ?? internal
  const setter = onValueChange ?? setInternal
  return <SelectContext.Provider value={{ value, onValueChange: setter, open, onOpenChange: setOpen }}>{children}</SelectContext.Provider>
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(SelectContext)
    return (
      <button ref={ref} type="button" className={cn("flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1", className)}
        onClick={() => ctx.onOpenChange(!ctx.open)} {...props}
      >
        {children}
        <span className="ml-2 text-xs opacity-50">▼</span>
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext)
  return <span>{ctx.value || placeholder}</span>
}

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(SelectContext)
    React.useEffect(() => {
      if (!ctx.open) return
      const handler = () => ctx.onOpenChange(false)
      document.addEventListener("mousedown", handler)
      return () => document.removeEventListener("mousedown", handler)
    }, [ctx.open, ctx.onOpenChange])
    if (!ctx.open) return null
    return (
      <div ref={ref} className={cn("relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md", className)}
        onMouseDown={(e) => e.stopPropagation()} {...props}
      >
        <div className="p-1">{children}</div>
      </div>
    )
  }
)
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = React.useContext(SelectContext)
    return (
      <div ref={ref} role="option" aria-selected={ctx.value === value}
        className={cn("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent", ctx.value === value && "bg-accent", className)}
        onClick={() => { ctx.onValueChange(value); ctx.onOpenChange(false) }} {...props}
      >
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

function SelectGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="group" {...props}>{children}</div>
}

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
)
SelectLabel.displayName = "SelectLabel"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel }
