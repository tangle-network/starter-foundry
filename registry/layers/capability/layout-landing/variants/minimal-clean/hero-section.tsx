import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-28 sm:py-36 lg:px-8 lg:py-44">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            NOW IN BETA
          </p>

          <h1 className="mt-8 text-4xl font-light tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {'{{headline}}'}
          </h1>

          <p className="mt-8 max-w-xl text-lg font-light leading-relaxed text-muted-foreground">
            Build faster, ship sooner, and scale with confidence. The modern platform
            that gives your team everything it needs to go from idea to production.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Button
              size="lg"
              className="h-12 rounded-lg px-8 font-medium shadow-lg shadow-primary/25 transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="group h-12 gap-2 rounded-lg border-2 border-transparent px-8 font-medium text-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-all hover:bg-transparent hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Learn more
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          <div className="mt-14 flex items-center justify-center gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-16 rounded bg-muted-foreground/10"
              />
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3">
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
    </section>
  )
}
