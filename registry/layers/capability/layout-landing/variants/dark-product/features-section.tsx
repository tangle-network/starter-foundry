import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <section className="bg-zinc-950 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            Everything you need to ship
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            A complete toolkit so your team can focus on building product, not plumbing.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-zinc-800 bg-zinc-900/50 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-[0_0_24px_-6px_rgba(16,185,129,0.15)]"
            >
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-zinc-50">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
