'use client'

import Link from 'next/link'
import {
  BillingDashboard,
  type BillingBalance,
  type BillingSubscription,
  type BillingUsage,
  UsageChart,
  type UsageDataPoint,
} from '@tangle-network/sandbox-ui/dashboard'
import { agentRoster } from '../src/lib/agent-roster'

// TODO(operator): wire these placeholders to the real Tangle billing /
// usage APIs. The shapes below match @tangle-network/sandbox-ui/dashboard's
// expected props — just point at your tenant's data source.
const placeholderBalance: BillingBalance = {
  available: 124.5,
  used: 42.18,
}

const placeholderSubscription: BillingSubscription = {
  tierName: 'team',
  status: 'active',
  renewsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
}

const placeholderUsage: BillingUsage = {
  period: 'month',
  total: 31.4,
  byModel: {
    'default-model': 31.4,
  },
}

const placeholderUsageSeries: UsageDataPoint[] = Array.from({ length: 14 }).map(
  (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toISOString(),
    value: Math.round((Math.sin(i / 2) + 1.5) * 10 * 10) / 10,
  }),
)

export default function FleetDashboardPage() {
  return (
    <div className='flex min-h-screen w-full flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]'>
      <header className='border-b border-[hsl(var(--border))] px-8 py-6'>
        <h1 className='text-2xl font-semibold'>{'{{appName}}'}</h1>
        <p className='text-sm text-[hsl(var(--muted-foreground))]'>
          Agent fleet — {agentRoster.length} agent
          {agentRoster.length === 1 ? '' : 's'} ready to dispatch.
        </p>
      </header>

      <main className='grid flex-1 gap-8 p-8 lg:grid-cols-[2fr_1fr]'>
        <section aria-labelledby='roster-heading'>
          <h2
            id='roster-heading'
            className='mb-4 text-lg font-medium text-[hsl(var(--foreground))]'
          >
            Agents
          </h2>
          <ul className='grid gap-4 sm:grid-cols-2'>
            {agentRoster.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/agents/${agent.id}`}
                  className='flex h-full flex-col gap-2 rounded-lg border border-[hsl(var(--border))] p-4 transition hover:border-[hsl(var(--primary))]'
                >
                  <div className='flex items-center gap-3'>
                    <span className='text-2xl' aria-hidden>
                      {agent.icon ?? '🤖'}
                    </span>
                    <div className='flex flex-col'>
                      <span className='font-medium'>{agent.displayName}</span>
                      <span className='font-mono text-xs text-[hsl(var(--muted-foreground))]'>
                        {agent.family}
                      </span>
                    </div>
                  </div>
                  <p className='text-sm text-[hsl(var(--muted-foreground))]'>
                    {agent.description}
                  </p>
                  <div className='mt-auto flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]'>
                    <span>
                      {agent.sandboxId ? (
                        <span className='inline-flex items-center gap-1'>
                          <span
                            className='h-2 w-2 rounded-full bg-emerald-500'
                            aria-hidden
                          />
                          ready
                        </span>
                      ) : (
                        <span className='inline-flex items-center gap-1'>
                          <span
                            className='h-2 w-2 rounded-full bg-amber-500'
                            aria-hidden
                          />
                          unprovisioned
                        </span>
                      )}
                    </span>
                    {/* TODO(operator): replace with real last-run timestamp from your run log. */}
                    <span>last run: —</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className='flex flex-col gap-6' aria-label='Account overview'>
          <div>
            <h2 className='mb-2 text-lg font-medium'>Billing</h2>
            {/* TODO(operator): swap placeholders for real billing data. */}
            <BillingDashboard
              balance={placeholderBalance}
              subscription={placeholderSubscription}
              usage={placeholderUsage}
              onManageSubscription={() => {
                window.location.href = '/settings/billing'
              }}
              onAddCredits={() => {
                window.location.href = '/settings/billing'
              }}
            />
          </div>
          <div>
            <h2 className='mb-2 text-lg font-medium'>Usage (14d)</h2>
            {/* TODO(operator): swap placeholders for real usage series. */}
            <UsageChart
              data={placeholderUsageSeries}
              title='Compute usage'
              unit='compute-hours'
            />
          </div>
        </aside>
      </main>
    </div>
  )
}
