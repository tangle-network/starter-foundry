import { Button } from '@/components/ui/button'
import { ArrowRight, Play } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 dark:from-violet-900 dark:via-blue-900 dark:to-cyan-800">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0 opacity-30"
      >
        <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-pulse rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 animate-pulse rounded-full bg-purple-300/20 blur-3xl [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 animate-pulse rounded-full bg-cyan-300/20 blur-3xl [animation-delay:2s]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-32 sm:py-40 lg:px-8 lg:py-48">
        <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80">
          Now in beta — get early access
        </div>

        <h1 className="mt-8 max-w-3xl text-center text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
          {'{{headline}}'}
        </h1>

        <p className="mt-6 max-w-xl text-center text-lg leading-relaxed text-white/80">
          Build faster, ship sooner, and scale with confidence. The modern platform
          that gives your team everything it needs to go from idea to production.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <Button
            size="lg"
            className="h-12 gap-2 rounded-lg bg-white px-8 font-medium text-violet-700 shadow-xl transition-all hover:bg-white/90 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-600 dark:bg-white dark:text-violet-700"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 gap-2 rounded-lg border-white/30 px-8 font-medium text-white transition-all hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-600"
          >
            <Play className="h-4 w-4" />
            See a Demo
          </Button>
        </div>

        <div className="mt-12 flex items-center gap-3">
          <div className="flex -space-x-2">
            {['bg-white', 'bg-cyan-300', 'bg-violet-300', 'bg-blue-300', 'bg-emerald-300'].map((color, i) => (
              <div
                key={i}
                className={`h-8 w-8 rounded-full border-2 border-white/30 ${color}`}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-white/70">
            Trusted by <span className="text-white">1,000+</span> teams
          </p>
        </div>
      </div>
    </section>
  )
}
