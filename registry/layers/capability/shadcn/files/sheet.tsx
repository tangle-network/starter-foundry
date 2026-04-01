import * as React from "react"
import { cn } from "@/lib/utils"

type SheetContextValue = { open: boolean; onOpenChange: (v: boolean) => void }
const SheetContext = React.createContext<SheetContextValue>({ open: false, onOpenChange: () => {} })

function Sheet({ open: controlledOpen, onOpenChange, children }: { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState(false)
  const open = controlledOpen ?? internal
  const setter = onOpenChange ?? setInternal
  return <SheetContext.Provider value={{ open, onOpenChange: setter }}>{children}</SheetContext.Provider>
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const ctx = React.useContext(SheetContext)
    return <button ref={ref} type="button" onClick={(e) => { ctx.onOpenChange(true); onClick?.(e) }} {...props} />
  }
)
SheetTrigger.displayName = "SheetTrigger"

const sheetSideStyles = {
  top: "inset-x-0 top-0 border-b",
  bottom: "inset-x-0 bottom-0 border-t",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
  right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
} as const

const SheetContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { side?: keyof typeof sheetSideStyles }>(
  ({ className, side = "right", children, ...props }, ref) => {
    const ctx = React.useContext(SheetContext)
    if (!ctx.open) return null
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/80" onClick={() => ctx.onOpenChange(false)} />
        <div ref={ref} className={cn("fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out", sheetSideStyles[side], className)} {...props}>
          {children}
          <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" onClick={() => ctx.onOpenChange(false)}>
            <span className="text-sm">✕</span>
            <span className="sr-only">Close</span>
          </button>
        </div>
      </>
    )
  }
)
SheetContent.displayName = "SheetContent"

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
  )
)
SheetTitle.displayName = "SheetTitle"

const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
SheetDescription.displayName = "SheetDescription"

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
