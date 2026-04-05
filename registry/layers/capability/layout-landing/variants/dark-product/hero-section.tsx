import { Button } from '@/components/ui/button'
import { ArrowRight, Play } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-zinc-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-28 sm:py-36 lg:px-8 lg:py-44">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="rounded-full border border-zinc-700 bg-zinc-800/50 px-4 py-1.5 text-xs font-medium tracking-wider text-zinc-400">
            NOW IN BETA — GET EARLY ACCESS
          </div>

          <h1 className="mt-8 text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
            {'{{headline}}'}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
            Build faster, ship sooner, and scale with confidence. The modern platform
            that gives your team everything it needs to go from idea to production.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Button
              size="lg"
              className="h-12 gap-2 rounded-lg bg-emerald-500 px-8 font-medium text-zinc-950 shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-lg border-2 border-zinc-700 px-8 font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <Play className="h-4 w-4" />
              See a Demo
            </Button>
          </div>

          <div className="mt-14 flex items-center justify-center gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-16 rounded bg-zinc-700/40"
              />
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              {['bg-emerald-400', 'bg-zinc-400', 'bg-emerald-300', 'bg-zinc-300', 'bg-emerald-500'].map((color, i) => (
                <div
                  key={i}
                  className={`h-8 w-8 rounded-full border-2 border-zinc-950 ${color}`}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-zinc-500">
              Trusted by <span className="text-zinc-300">1,000+</span> teams
            </p>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-emerald-500 to-emerald-500/30 opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>
    </section>
  )
}
