'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import personalize from '@/personalize.json'

export function PricingSection() {
  const [yearly, setYearly] = React.useState(false)
  const { pricing } = personalize

  return (
    <section id="pricing" className="relative bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {pricing.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {pricing.headline}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            {pricing.subheadline}
          </p>
        </div>

        <div className="mt-12 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                !yearly ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {pricing.toggleMonthly}
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                yearly ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {pricing.toggleYearly}
              {!yearly && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {pricing.yearlyDiscount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-6">
          {pricing.tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'relative rounded-2xl bg-card p-8 transition-all',
                tier.highlighted
                  ? 'border-2 border-primary bg-gradient-to-b from-primary/5 to-transparent shadow-2xl shadow-primary/10 ring-1 ring-primary/20 lg:scale-105'
                  : 'border border-border/50 shadow-sm hover:shadow-md',
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm font-medium text-muted-foreground">
                      {tier.period}
                    </span>
                  )}
                </div>

                <ul className="space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div>
                  <Button
                    variant={tier.highlighted ? 'default' : 'outline'}
                    className={cn(
                      'h-12 w-full rounded-lg font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      tier.highlighted ? 'shadow-lg shadow-primary/25' : 'border-2',
                    )}
                  >
                    {tier.cta}
                  </Button>
                  {tier.note && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">{tier.note}</p>
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
