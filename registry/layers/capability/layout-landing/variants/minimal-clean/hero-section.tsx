import { ArrowRight } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-32 sm:py-40 lg:px-8 lg:py-48">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-8 text-sm tracking-widest text-muted-foreground/60">
            NOW IN BETA
          </p>

          <h1 className="text-4xl font-light tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {'{{headline}}'}
          </h1>

          <p className="mt-8 text-lg font-light leading-relaxed text-muted-foreground">
            Build faster, ship sooner, and scale with confidence. The modern platform
            that gives your team everything it needs to go from idea to production.
          </p>

          <div className="mt-12">
            <a
              href="/sign-up"
              className="group inline-flex items-center gap-2 text-base font-medium text-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
