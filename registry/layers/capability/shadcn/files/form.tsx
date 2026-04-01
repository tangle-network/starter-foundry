import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

type FormFieldContextValue = { id: string; name: string; error?: string }
const FormFieldContext = React.createContext<FormFieldContextValue>({ id: "", name: "" })

function FormField({ name, children, error }: { name: string; children: React.ReactNode; error?: string }) {
  const id = React.useId()
  return <FormFieldContext.Provider value={{ id, name, error }}>{children}</FormFieldContext.Provider>
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props} />
  )
)
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    const { id, error } = React.useContext(FormFieldContext)
    return <Label ref={ref} htmlFor={id} className={cn(error && "text-destructive", className)} {...props} />
  }
)
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => {
    const { id, error } = React.useContext(FormFieldContext)
    return <div ref={ref} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-message` : undefined} {...props} />
  }
)
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[0.8rem] text-muted-foreground", className)} {...props} />
  )
)
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { id, error } = React.useContext(FormFieldContext)
    const message = error || children
    if (!message) return null
    return (
      <p ref={ref} id={`${id}-message`} className={cn("text-[0.8rem] font-medium text-destructive", className)} {...props}>
        {message}
      </p>
    )
  }
)
FormMessage.displayName = "FormMessage"

export { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage }
