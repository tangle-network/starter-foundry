'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const tiers = [
  {
    name: 'Free',
    price: { monthly: '$0', yearly: '$0' },
    description: 'For side projects and experimentation.',
    features: [
      'Up to 3 projects',
      '1 GB storage',
      'Community support',
      'Basic analytics',
    ],
    cta: 'Get Started',
    highlighted: false,
    note: 'No credit card required',
  },
  {
    name: 'Pro',
    price: { monthly: '$29', yearly: '$24' },
    description: 'For growing teams that need more power.',
    features: [
      'Unlimited projects',
      '100 GB storage',
      'Priority support',
      'Advanced analytics',
      'Custom domains',
      'Team roles',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
    note: null,
  },
  {
    name: 'Enterprise',
    price: { monthly: 'Custom', yearly: 'Custom' },
    description: 'For organizations with advanced needs.',
    features: [
      'Everything in Pro',
      'Unlimited storage',
      'Dedicated support engineer',
      'SSO / SAML',
      'SLA guarantees',
      'Audit logs',
    ],
    cta: 'Contact Sales',
    highlighted: false,
    note: null,
  },
]

export function PricingSection() {
  const [yearly, setYearly] = React.useState(false)

  return (
    <section className="bg-zinc-900/50 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Choose your plan. Start free, upgrade when you are ready.
          </p>

          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/50 p-1">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
                !yearly
                  ? 'bg-zinc-700 text-zinc-50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
                yearly
                  ? 'bg-zinc-700 text-zinc-50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Yearly
              <span className="text-xs font-medium text-emerald-400">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl items-start gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/80 p-8',
                tier.highlighted &&
                  'relative z-10 border-emerald-500/40 shadow-[0_0_32px_-8px_rgba(16,185,129,0.2)] lg:scale-105'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1 text-xs font-medium text-zinc-950">
                  Most Popular
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-50">
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {tier.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-zinc-50">
                    {yearly ? tier.price.yearly : tier.price.monthly}
                  </span>
                  {tier.price.monthly !== 'Custom' && (
                    <span className="text-sm text-zinc-500">/mo</span>
                  )}
                </div>

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-zinc-400">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div>
                  <Button
                    variant={tier.highlighted ? 'default' : 'outline'}
                    className={cn(
                      'h-12 w-full rounded-lg font-medium transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
                      tier.highlighted
                        ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                        : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50'
                    )}
                  >
                    {tier.cta}
                  </Button>
                  {tier.note && (
                    <p className="mt-3 text-center text-xs text-zinc-500">
                      {tier.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
