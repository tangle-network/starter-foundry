import { Layers, Globe, Lock } from 'lucide-react'

const primaryFeatures = [
  {
    title: 'Lightning Fast',
    description:
      'Optimized for speed with edge-first architecture. Sub-second response times out of the box with automatic CDN distribution.',
  },
  {
    title: 'Secure by Default',
    description:
      'Enterprise-grade security with end-to-end encryption, SOC 2 compliance, and role-based access controls baked into every layer.',
  },
  {
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
    <section className="bg-muted/20 py-24 dark:bg-muted/5 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Everything you need to ship
          </h2>
          <p className="mt-4 text-lg font-light leading-relaxed text-muted-foreground">
            A complete toolkit so your team can focus on building product, not plumbing.
          </p>
        </div>

        <div className="mx-auto mt-20 max-w-2xl">
          {primaryFeatures.map((feature, i) => (
            <div key={feature.title}>
              {i > 0 && <div className="border-t border-border/50" />}
              <div className="py-10">
                <h3 className="text-lg font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-4 max-w-2xl border-t pt-10">
          <div className="grid gap-8 sm:grid-cols-3">
            {secondaryFeatures.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
