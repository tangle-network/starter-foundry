'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
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
    <section className="bg-muted/20 py-24 dark:bg-muted/5 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg font-light text-muted-foreground">
            Start free. Upgrade when you are ready.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 text-sm">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                'pb-1 font-medium transition-colors',
                !yearly ? 'border-b border-foreground text-foreground' : 'text-muted-foreground'
              )}
            >
              Monthly
            </button>
            <span className="text-muted-foreground/40">/</span>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                'pb-1 font-medium transition-colors',
                yearly ? 'border-b border-foreground text-foreground' : 'text-muted-foreground'
              )}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'flex flex-col rounded-lg p-8',
                tier.highlighted ? 'bg-muted/40 dark:bg-muted/15' : 'bg-transparent'
              )}
            >
              <p className="text-sm font-medium text-foreground">{tier.name}</p>
              <div className="mt-4">
                <span className="text-4xl font-light tracking-tight text-foreground">
                  {yearly ? tier.price.yearly : tier.price.monthly}
                </span>
                {tier.price.monthly !== 'Custom' && (
                  <span className="text-sm text-muted-foreground"> /mo</span>
                )}
              </div>
              <p className="mt-3 text-sm font-light text-muted-foreground">{tier.description}</p>
              <Separator className="my-6" />
              <ul className="flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-light text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-8 w-full"
                variant={tier.highlighted ? 'default' : 'outline'}
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
