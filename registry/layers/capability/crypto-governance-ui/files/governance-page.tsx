'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, Vote, Users, FileText, Wallet } from 'lucide-react'
import { ProposalCard, type Proposal } from './proposal-card'

const FILTERS = ['All', 'Active', 'Passed', 'Defeated'] as const
type Filter = (typeof FILTERS)[number]

const DEMO_PROPOSALS: Proposal[] = [
  { id: 42, title: 'Increase treasury diversification into stablecoins', status: 'active', author: '0x1234567890abcdef1234567890abcdef12345678', createdAt: '2d ago', votesFor: 1200000, votesAgainst: 300000, votesAbstain: 50000, quorumPct: 72, timeRemaining: '2d left' },
  { id: 41, title: 'Deploy protocol on Arbitrum and Base', status: 'passed', author: '0xabcdef1234567890abcdef1234567890abcdef12', createdAt: '5d ago', votesFor: 2100000, votesAgainst: 150000, votesAbstain: 80000, quorumPct: 100, timeRemaining: 'Ended 1d ago' },
  { id: 40, title: 'Reduce validator minimum stake requirement', status: 'defeated', author: '0x9876543210fedcba9876543210fedcba98765432', createdAt: '8d ago', votesFor: 400000, votesAgainst: 900000, votesAbstain: 200000, quorumPct: 65, timeRemaining: 'Ended 3d ago' },
  { id: 39, title: 'Grant funding for developer tooling initiative', status: 'active', author: '0x1111222233334444555566667777888899990000', createdAt: '1d ago', votesFor: 800000, votesAgainst: 100000, votesAbstain: 20000, quorumPct: 45, timeRemaining: '4d left' },
]

export function GovernancePage() {
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')

  const filtered = DEMO_PROPOSALS.filter((p) => {
    if (filter !== 'All' && p.status !== filter.toLowerCase()) return false
    if (query && !p.title.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const stats = [
    { label: 'Total Proposals', value: '42', icon: FileText },
    { label: 'Active', value: '2', icon: Vote },
    { label: 'Participation', value: '68%', icon: Users },
    { label: 'Your Voting Power', value: '12,500 GOV', icon: Wallet },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Governance</h1>
          <p className="text-sm text-muted-foreground">GOV Token Governance</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Proposal
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-semibold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f}>{f}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
            No proposals found.
          </p>
        )}
      </div>
    </div>
  )
}
