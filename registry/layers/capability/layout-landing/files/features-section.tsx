import { Zap, Shield, BarChart3, Layers, Globe, Lock } from 'lucide-react'

const primaryFeatures = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Optimized for speed with edge-first architecture. Sub-second response times out of the box with automatic CDN distribution.',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description:
      'Enterprise-grade security with end-to-end encryption, SOC 2 compliance, and role-based access controls baked into every layer.',
  },
  {
    icon: BarChart3,
    title: 'Built-in Analytics',
    description:
      'Real-time dashboards and custom reports so you always know what is working. Track every metric that matters to your business.',
  },
]

const secondaryFeatures = [
  { icon: Layers, label: 'Composable modules — pick only the pieces you need' },
  { icon: Globe, label: 'Deploy to 30+ regions with a single command' },
  { icon: Lock, label: 'SSO, SAML, and audit logs for compliance' },
]

export function FeaturesSection() {
  return (
    <section className="bg-muted/30 py-24 dark:bg-muted/10 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything you need to ship
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            A complete toolkit so your team can focus on building product, not plumbing.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
          {primaryFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border/50 bg-card p-8 transition-all duration-200 hover:border-border hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-3xl border-t pt-10">
          <div className="grid gap-6 sm:grid-cols-3">
            {secondaryFeatures.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-4 w-4" />
                </div>
                <p className="text-sm leading-snug text-muted-foreground">
                  {feature.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
