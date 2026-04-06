import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import personalize from '@/personalize.json'

function getIcon(name: string): LucideIcon {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name]
  return Icon ?? Icons.Sparkles
}

export function FeaturesSection() {
  const { features } = personalize
  return (
    <section id="features" className="relative bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {features.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {features.headline}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            {features.subheadline}
          </p>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.primary.map((feature, i) => {
            const Icon = getIcon(feature.icon)
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-8 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md"
                style={{ animation: `fadeInUp 0.6s ease ${i * 0.15}s both` }}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-16 grid gap-8 border-t border-border/50 pt-16 sm:grid-cols-3">
          {features.secondary.map((feature) => {
            const Icon = getIcon(feature.icon)
            return (
              <div key={feature.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{feature.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  )
}
