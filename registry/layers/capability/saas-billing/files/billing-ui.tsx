'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Check } from 'lucide-react'

interface Plan {
  id: string
  name: string
  priceMonthly: number
  limits: Record<string, number>
  features?: string[]
}

interface PricingTableProps {
  plans: Plan[]
  currentPlan?: string
  onSelectPlan: (planId: string) => void
}

const DEFAULT_FEATURES: Record<string, string[]> = {
  free: ['100 API calls/mo', '1 seat', 'Community support'],
  pro: ['10,000 API calls/mo', '5 seats', 'Priority support', 'Custom integrations'],
  team: ['100,000 API calls/mo', '25 seats', 'Dedicated support', 'SSO', 'Audit logs', 'SLA'],
}

export function PricingTable({ plans, currentPlan, onSelectPlan }: PricingTableProps) {
  const [annual, setAnnual] = useState(false)
  const discount = 0.8

  async function handleSelect(planId: string) {
    const res = await fetch('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    else onSelectPlan(planId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-3">
        <span className="text-sm font-medium">Monthly</span>
        <Switch checked={annual} onCheckedChange={setAnnual} />
        <span className="text-sm font-medium">
          Annual <Badge variant="secondary">Save 20%</Badge>
        </span>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const price = annual ? Math.round(plan.priceMonthly * discount) : plan.priceMonthly
          const features = plan.features ?? DEFAULT_FEATURES[plan.id] ?? []

          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary ring-2 ring-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current Plan</Badge>}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold">
                    {price === 0 ? 'Free' : `$${price}`}
                  </span>
                  {price > 0 && <span className="text-muted-foreground">/mo</span>}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : plan.id === 'pro' ? 'default' : 'secondary'}
                  disabled={isCurrent || plan.priceMonthly === 0}
                  onClick={() => handleSelect(plan.id)}
                >
                  {isCurrent ? 'Current Plan' : price === 0 ? 'Get Started' : 'Upgrade'}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
