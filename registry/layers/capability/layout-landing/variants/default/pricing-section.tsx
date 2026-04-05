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
  },
]

export function PricingSection() {
  const [yearly, setYearly] = React.useState(false)

  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Choose your plan. Start free, upgrade when you are ready.
          </p>

          {/* Pill toggle */}
          <div className="relative mt-8 inline-flex items-center rounded-full border bg-muted/50 p-1 dark:bg-muted/20">
            {/* Sliding indicator */}
            <div
              className={cn(
                'absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-primary shadow-sm transition-transform duration-200 ease-out',
                yearly ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0.5'
              )}
            />
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                'relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                !yearly
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                'relative z-10 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                yearly
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Yearly
              {!yearly && <span className="text-xs font-medium text-primary">Save 20%</span>}
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl items-start gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'flex flex-col rounded-xl border p-8',
                tier.highlighted
                  ? 'relative z-10 border-2 border-primary bg-gradient-to-b from-primary/5 to-transparent shadow-2xl shadow-primary/10 ring-1 ring-primary/20 lg:scale-105'
                  : 'border-border/50 bg-card shadow-sm'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                  Most Popular
                </div>
              )}

              <div className="space-y-8">
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

                <ul className="space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div>
                  <Button
                    variant={tier.highlighted ? 'default' : 'outline'}
                    className={cn(
                      'h-12 w-full rounded-lg font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      tier.highlighted && 'shadow-lg shadow-primary/25'
                    )}
                  >
                    {tier.cta}
                  </Button>
                  {tier.name === 'Free' && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      No credit card required
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
