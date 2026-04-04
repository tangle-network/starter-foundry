import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-6">
            Now in beta — get early access
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {'{{headline}}'}
          </h1>

          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Build faster, ship sooner, and scale with confidence. The modern platform
            that gives your team everything it needs to go from idea to production.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" className="gap-2">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              See a Demo
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="flex items-center justify-center rounded-xl border bg-muted/30 p-12 dark:bg-muted/10">
            <p className="text-sm text-muted-foreground">
              Hero image or product screenshot
            </p>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-primary/30 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>
    </section>
  )
}
