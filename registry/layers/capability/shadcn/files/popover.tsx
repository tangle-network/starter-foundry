import * as React from "react"
import { cn } from "@/lib/utils"

type PopoverContextValue = { open: boolean; onOpenChange: (v: boolean) => void }
const PopoverContext = React.createContext<PopoverContextValue>({ open: false, onOpenChange: () => {} })

function Popover({ open: controlledOpen, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(false)
  const open = controlledOpen ?? internal
  const setter = onOpenChange ?? setInternal
  return <PopoverContext.Provider value={{ open, onOpenChange: setter }}>{children}</PopoverContext.Provider>
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const ctx = React.useContext(PopoverContext)
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => { ctx.onOpenChange(!ctx.open); onClick?.(e) }
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; ref?: React.Ref<HTMLButtonElement> }>
      return React.cloneElement(child, { onClick: handle, ref })
    }
    return <button ref={ref} type="button" onClick={handle} {...props}>{children}</button>
  }
)
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; sideOffset?: number }>(
  ({ className, align = "center", sideOffset: _sideOffset, children, ...props }, ref) => {
    const ctx = React.useContext(PopoverContext)
    if (!ctx.open) return null
    const alignClass = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={() => ctx.onOpenChange(false)} />
        <div
          ref={ref}
          className={cn(
            "absolute z-50 mt-2 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
            alignClass,
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </>
    )
  }
)
PopoverContent.displayName = "PopoverContent"

const PopoverAnchor = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
