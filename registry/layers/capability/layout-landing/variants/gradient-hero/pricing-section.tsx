'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <section className="bg-muted/30 py-24 dark:bg-muted/10 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade when you are ready.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border bg-muted/50 p-1 dark:bg-muted/20">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                !yearly ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                yearly ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mx-auto mt-16 flex max-w-6xl flex-col gap-6 lg:flex-row">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                'relative flex flex-1 flex-col',
                tier.highlighted
                  ? 'border-2 border-transparent bg-gradient-to-b from-violet-500/10 to-blue-500/10 shadow-xl ring-2 ring-violet-500/50'
                  : 'border'
              )}
            >
              <CardHeader>
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-5xl font-extrabold tracking-tight text-foreground">
                    {yearly ? tier.price.yearly : tier.price.monthly}
                  </span>
                  {tier.price.monthly !== 'Custom' && (
                    <span className="text-sm text-muted-foreground"> /mo</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col pt-2">
                <ul className="flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    'mt-8 w-full',
                    tier.highlighted && 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700'
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
