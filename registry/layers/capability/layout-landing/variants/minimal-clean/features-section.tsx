import { Separator } from '@/components/ui/separator'

const features = [
  {
    title: 'Lightning Fast',
    description: 'Optimized for speed with edge-first architecture. Sub-second response times out of the box.',
  },
  {
    title: 'Secure by Default',
    description: 'Enterprise-grade security with end-to-end encryption, SOC 2 compliance, and role-based access.',
  },
  {
    title: 'Built-in Analytics',
    description: 'Real-time dashboards and custom reports so you always know what is working and what is not.',
  },
  {
    title: 'Composable Modules',
    description: 'Pick only the pieces you need. Every module is independently deployable and fully typed.',
  },
  {
    title: 'Global Scale',
    description: 'Deploy to 30+ regions with a single command. Automatic failover and geo-routing included.',
  },
  {
    title: 'Priority Support',
    description: 'Dedicated engineers on call. Average first-response time under 15 minutes for paid plans.',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Everything you need to ship
          </h2>
          <p className="mt-4 text-lg font-light text-muted-foreground">
            A complete toolkit so your team can focus on building product, not plumbing.
          </p>
        </div>

        <div className="mx-auto mt-20 max-w-2xl">
          {features.map((feature, i) => (
            <div key={feature.title}>
              {i > 0 && <Separator className="my-0" />}
              <div className="py-10">
                <h3 className="text-lg font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-base font-light leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
