import { Button } from '@/components/ui/button'
import { ArrowRight, Play } from 'lucide-react'
import personalize from '@/personalize.json'

export function HeroSection() {
  const { hero, trust } = personalize
  return (
    <section className="relative overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]"
      />
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
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="rounded-full border border-border/40 bg-muted/50 px-4 py-1.5 text-xs font-medium tracking-wider text-muted-foreground backdrop-blur-sm">
              {hero.badge}
            </div>

            <h1 className="mt-8 text-5xl font-bold tracking-tighter text-foreground sm:text-6xl lg:text-7xl">
              {hero.headline}
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {hero.subheadline}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-lg px-8 font-medium shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {hero.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-lg border-2 px-8 font-medium transition-transform hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Play className="h-4 w-4" />
                {hero.ctaSecondary}
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
                {trust.label}
              </p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:mx-0">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-4 rounded-2xl bg-primary/10 blur-2xl"
            />
            <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl shadow-primary/5">
              <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <div className="ml-3 flex-1 rounded-md bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                  {personalize.brand.name.toLowerCase()}.com
                </div>
              </div>
              <div className="relative aspect-[4/3]">
                <img
                  src="/images/hero-product.png"
                  alt={`${personalize.brand.name} product screenshot`}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{personalize.brand.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{personalize.brand.tagline}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
