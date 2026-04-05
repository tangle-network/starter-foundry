import { Button } from '@/components/ui/button'
import { ArrowRight, Play } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="mx-auto max-w-7xl px-6 py-28 sm:py-36 lg:px-8 lg:py-44">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="rounded-full border border-border/50 bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Now in beta — get early access
          </div>

          <h1 className="mt-8 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {'{{headline}}'}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Build faster, ship sooner, and scale with confidence. The modern platform
            that gives your team everything it needs to go from idea to production.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Button
              size="lg"
              className="h-12 gap-2 rounded-lg px-8 font-medium transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-lg px-8 font-medium transition-all hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Play className="h-4 w-4" />
              See a Demo
            </Button>
          </div>

          <div className="mt-12 flex items-center gap-3">
            <div className="flex -space-x-2">
              {['bg-primary', 'bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4'].map((color, i) => (
                <div
                  key={i}
                  className={`h-8 w-8 rounded-full border-2 border-background ${color}`}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Trusted by <span className="text-foreground">1,000+</span> teams
            </p>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-primary/30 opacity-15 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>
    </section>
  )
}
