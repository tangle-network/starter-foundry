import { Zap, Shield, BarChart3, Layers, Globe, Headphones } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Optimized for speed with edge-first architecture. Sub-second response times out of the box.',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'Enterprise-grade security with end-to-end encryption, SOC 2 compliance, and role-based access.',
  },
  {
    icon: BarChart3,
    title: 'Built-in Analytics',
    description: 'Real-time dashboards and custom reports so you always know what is working and what is not.',
  },
  {
    icon: Layers,
    title: 'Composable Modules',
    description: 'Pick only the pieces you need. Every module is independently deployable and fully typed.',
  },
  {
    icon: Globe,
    title: 'Global Scale',
    description: 'Deploy to 30+ regions with a single command. Automatic failover and geo-routing included.',
  },
  {
    icon: Headphones,
    title: 'Priority Support',
    description: 'Dedicated engineers on call. Average first-response time under 15 minutes for paid plans.',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to ship
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete toolkit so your team can focus on building product, not plumbing.
          </p>
        </div>

        <div className="mx-auto mt-20 max-w-5xl space-y-16">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`flex flex-col items-center gap-8 md:flex-row ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
            >
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg">
                <feature.icon className="h-10 w-10" />
              </div>
              <div className={`text-center ${i % 2 === 1 ? 'md:text-right' : 'md:text-left'}`}>
                <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
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
