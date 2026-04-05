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
    <section className="bg-muted/30 py-24 dark:bg-muted/10 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Choose your plan. Start free, upgrade when you are ready.
          </p>

          <div className="mt-8 inline-flex items-center gap-1 rounded-full border bg-muted/50 p-1 dark:bg-muted/20">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
                !yearly
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
                yearly
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Yearly
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl items-start gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'flex flex-col rounded-xl border bg-card p-8 shadow-sm',
                tier.highlighted &&
                  'relative z-10 border-2 border-transparent bg-gradient-to-b from-violet-500/10 to-blue-500/10 shadow-xl ring-2 ring-violet-500/50 lg:scale-105'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-1 text-xs font-medium text-white">
                  Most Popular
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tier.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground">
                    {yearly ? tier.price.yearly : tier.price.monthly}
                  </span>
                  {tier.price.monthly !== 'Custom' && (
                    <span className="text-sm text-muted-foreground">/mo</span>
                  )}
                </div>

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div>
                  <Button
                    variant={tier.highlighted ? 'default' : 'outline'}
                    className={cn(
                      'h-12 w-full rounded-lg font-medium transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
                      tier.highlighted && 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700'
                    )}
                  >
                    {tier.cta}
                  </Button>
                  {tier.note && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">
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
