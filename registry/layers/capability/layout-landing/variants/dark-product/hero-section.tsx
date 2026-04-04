import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-zinc-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-6 border-zinc-700 text-zinc-400">
            Now in beta — get early access
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
            {'{{headline}}'}
          </h1>

          <p className="mt-6 text-lg leading-8 text-zinc-400">
            Build faster, ship sooner, and scale with confidence. The modern platform
            that gives your team everything it needs to go from idea to production.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" className="gap-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50">
              See a Demo
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-16">
            <p className="text-sm text-zinc-500">
              Product screenshot or demo
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
