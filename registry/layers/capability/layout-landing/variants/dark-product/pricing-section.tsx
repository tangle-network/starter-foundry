'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const tiers = [
  {
    name: 'Free',
    price: { monthly: '$0', yearly: '$0' },
    description: 'For side projects and experimentation.',
    features: ['Up to 3 projects', '1 GB storage', 'Community support', 'Basic analytics'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: { monthly: '$29', yearly: '$24' },
    description: 'For growing teams that need more power.',
    features: ['Unlimited projects', '100 GB storage', 'Priority support', 'Advanced analytics', 'Custom domains', 'Team roles'],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: { monthly: 'Custom', yearly: 'Custom' },
    description: 'For organizations with advanced needs.',
    features: ['Everything in Pro', 'Unlimited storage', 'Dedicated support engineer', 'SSO / SAML', 'SLA guarantees', 'Audit logs'],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export function PricingSection() {
  const [yearly, setYearly] = React.useState(false)

  return (
    <section className="bg-zinc-900/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Start free. Upgrade when you are ready.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-zinc-700 bg-zinc-800/50 p-1">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                !yearly ? 'bg-zinc-700 text-zinc-50 shadow-sm' : 'text-zinc-400'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                yearly ? 'bg-zinc-700 text-zinc-50 shadow-sm' : 'text-zinc-400'
              )}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                'relative flex flex-col border-zinc-800 bg-zinc-900/80',
                tier.highlighted && 'border-emerald-500/40 shadow-[0_0_32px_-8px_rgba(16,185,129,0.2)]'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-medium text-zinc-950">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg text-zinc-50">{tier.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold tracking-tight text-zinc-50">
                    {yearly ? tier.price.yearly : tier.price.monthly}
                  </span>
                  {tier.price.monthly !== 'Custom' && (
                    <span className="text-sm text-zinc-500"> /mo</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-400">{tier.description}</p>
              </CardHeader>
              <Separator className="bg-zinc-800" />
              <CardContent className="flex flex-1 flex-col pt-6">
                <ul className="flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-zinc-400">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    'mt-8 w-full',
                    tier.highlighted
                      ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50'
                  )}
                  variant={tier.highlighted ? 'default' : 'outline'}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
