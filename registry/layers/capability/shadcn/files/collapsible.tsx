import * as React from "react"

type CollapsibleContextValue = { open: boolean; onOpenChange: (v: boolean) => void }
const CollapsibleContext = React.createContext<CollapsibleContextValue>({ open: false, onOpenChange: () => {} })

function Collapsible({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (v: boolean) => void
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const [internal, setInternal] = React.useState(defaultOpen ?? false)
  const open = controlledOpen ?? internal
  const setter = onOpenChange ?? setInternal
  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange: setter }}>
      <div data-state={open ? "open" : "closed"} {...props}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const ctx = React.useContext(CollapsibleContext)
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => { ctx.onOpenChange(!ctx.open); onClick?.(e) }
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; ref?: React.Ref<HTMLButtonElement> }>
      return React.cloneElement(child, { onClick: handle, ref })
    }
    return <button ref={ref} type="button" onClick={handle} data-state={ctx.open ? "open" : "closed"} {...props}>{children}</button>
  }
)
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => {
    const ctx = React.useContext(CollapsibleContext)
    if (!ctx.open) return null
    return <div ref={ref} data-state="open" {...props}>{children}</div>
  }
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
