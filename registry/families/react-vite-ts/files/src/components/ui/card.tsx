import * as React from 'react'

type DivProps = React.HTMLAttributes<HTMLDivElement>

export const Card = React.forwardRef<HTMLDivElement, DivProps>(function Card(props, ref) {
  return <div ref={ref} {...props} />
})
export const CardHeader = React.forwardRef<HTMLDivElement, DivProps>(function CardHeader(props, ref) {
  return <div ref={ref} {...props} />
})
export const CardTitle = React.forwardRef<HTMLDivElement, DivProps>(function CardTitle(props, ref) {
  return <div ref={ref} {...props} />
})
export const CardDescription = React.forwardRef<HTMLDivElement, DivProps>(function CardDescription(props, ref) {
  return <div ref={ref} {...props} />
})
export const CardContent = React.forwardRef<HTMLDivElement, DivProps>(function CardContent(props, ref) {
  return <div ref={ref} {...props} />
})
export const CardFooter = React.forwardRef<HTMLDivElement, DivProps>(function CardFooter(props, ref) {
  return <div ref={ref} {...props} />
})
