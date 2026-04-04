import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

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
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-white/70">
          Now in beta — get early access
        </p>

        <h1 className="max-w-3xl text-center text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
          {'{{headline}}'}
        </h1>

        <p className="mt-6 max-w-xl text-center text-lg leading-8 text-white/80">
          Build faster, ship sooner, and scale with confidence. The modern platform
          that gives your team everything it needs to go from idea to production.
        </p>

        <div className="mt-12">
          <Button
            size="lg"
            className="gap-2 bg-white text-violet-700 shadow-xl hover:bg-white/90 dark:bg-white dark:text-violet-700"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
