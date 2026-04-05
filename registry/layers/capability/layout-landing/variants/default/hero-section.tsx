import { Button } from '@/components/ui/button'
import { ArrowRight, Play } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Radial gradient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]"
      />

      {/* Decorative blur orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-chart-2/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36 lg:px-8 lg:py-44">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column — text content */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wider text-muted-foreground backdrop-blur-sm">
              NOW IN BETA — GET EARLY ACCESS
            </div>

            <h1 className="mt-8 text-5xl font-bold tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
              {'{{headline}}'}
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Build faster, ship sooner, and scale with confidence. The modern platform
              that gives your team everything it needs to go from idea to production.
            </p>

            <div className="mt-10 flex items-center gap-4">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-lg px-8 font-medium shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-lg border-2 px-8 font-medium transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Play className="h-4 w-4" />
                See a Demo
              </Button>
            </div>

            <div className="mt-10 flex items-center gap-3">
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

          {/* Right column — product mockup */}
          <div className="relative mx-auto w-full max-w-lg lg:mx-0">
            {/* Glow behind mockup */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-4 rounded-2xl bg-primary/10 blur-2xl"
            />
            <div className="relative rounded-xl border border-border/50 bg-card shadow-2xl shadow-primary/5 overflow-hidden">
              {/* Browser toolbar */}
              <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <div className="ml-3 flex-1 rounded-md bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                  yourapp.com
                </div>
              </div>
              {/* Content area */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/5 via-background to-chart-2/5">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
                  <div className="h-3 w-3/4 rounded bg-muted-foreground/10" />
                  <div className="h-3 w-1/2 rounded bg-muted-foreground/10" />
                  <div className="mt-4 grid w-full grid-cols-3 gap-3">
                    <div className="aspect-square rounded-lg bg-primary/10" />
                    <div className="aspect-square rounded-lg bg-chart-1/10" />
                    <div className="aspect-square rounded-lg bg-chart-2/10" />
                  </div>
                  <div className="mt-4 h-8 w-1/3 rounded-md bg-primary/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
