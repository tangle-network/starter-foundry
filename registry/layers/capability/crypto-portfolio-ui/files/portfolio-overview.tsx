'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { TokenRow, type TokenHolding } from './token-row'

const CHAINS = ['All', 'Ethereum', 'Solana', 'Arbitrum', 'Base']

type SortKey = 'value' | 'change' | 'name'

const DEMO_HOLDINGS: TokenHolding[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: '4.25', price: '$1,850.00', value: '$7,862.50', change: 2.4, portfolioPct: 45, color: '#627EEA' },
  { symbol: 'SOL', name: 'Solana', balance: '120', price: '$22.50', value: '$2,700.00', change: -1.8, portfolioPct: 15, color: '#9945FF' },
  { symbol: 'USDC', name: 'USD Coin', balance: '3,500', price: '$1.00', value: '$3,500.00', change: 0.01, portfolioPct: 20, color: '#2775CA' },
  { symbol: 'LINK', name: 'Chainlink', balance: '200', price: '$7.80', value: '$1,560.00', change: 5.2, portfolioPct: 9, color: '#2A5ADA' },
  { symbol: 'ARB', name: 'Arbitrum', balance: '1,800', price: '$1.05', value: '$1,890.00', change: -3.1, portfolioPct: 11, color: '#28A0F0' },
]

export function PortfolioOverview() {
  const [chain, setChain] = useState('All')
  const [sortBy, setSortBy] = useState<SortKey>('value')

  const totalValue = '$17,512.50'
  const totalChange = 1.8

  const sorted = [...DEMO_HOLDINGS].sort((a, b) => {
    if (sortBy === 'value') return parseFloat(b.value.replace(/[$,]/g, '')) - parseFloat(a.value.replace(/[$,]/g, ''))
    if (sortBy === 'change') return Math.abs(b.change) - Math.abs(a.change)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-4xl font-bold">{totalValue}</span>
            <span className={`flex items-center gap-1 text-sm font-medium ${totalChange >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {totalChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {totalChange >= 0 ? '+' : ''}{totalChange}% (24h)
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Chart placeholder
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Holdings</CardTitle>
            <div className="flex items-center gap-1">
              {(['value', 'change', 'name'] as SortKey[]).map((key) => (
                <Button
                  key={key}
                  variant={sortBy === key ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setSortBy(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={chain} onValueChange={setChain}>
              <TabsList className="mb-3">
                {CHAINS.map((c) => (
                  <TabsTrigger key={c} value={c} className="text-xs">
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>24h</TableHead>
                  <TableHead>Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((holding) => (
                  <TokenRow key={holding.symbol} holding={holding} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
