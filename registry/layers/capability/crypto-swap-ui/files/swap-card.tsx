'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ArrowUpDown, Settings, ChevronDown, Loader2 } from 'lucide-react'

interface TokenInput {
  symbol: string
  amount: string
  balance: string
}

const SLIPPAGE_OPTIONS = ['0.1', '0.5', '1']

export function SwapCard() {
  const [from, setFrom] = useState<TokenInput>({ symbol: 'ETH', amount: '', balance: '1.234' })
  const [to, setTo] = useState<TokenInput>({ symbol: 'USDC', amount: '', balance: '500.00' })
  const [slippage, setSlippage] = useState('0.5')
  const [customSlippage, setCustomSlippage] = useState('')
  const [swapping, setSwapping] = useState(false)
  const [rotated, setRotated] = useState(false)

  const handleSwapDirection = () => {
    setFrom(to)
    setTo(from)
    setRotated(!rotated)
  }

  const activeSlippage = customSlippage || slippage

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Swap</CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <p className="text-sm font-medium mb-2">Slippage Tolerance</p>
            <div className="flex items-center gap-1.5">
              {SLIPPAGE_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  variant={slippage === opt && !customSlippage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setSlippage(opt); setCustomSlippage('') }}
                >
                  {opt}%
                </Button>
              ))}
              <Input
                placeholder="Custom"
                value={customSlippage}
                onChange={(e) => setCustomSlippage(e.target.value)}
                className="h-8 w-20 text-sm"
              />
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="rounded-lg border bg-muted/30 p-3 dark:bg-muted/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">From</span>
            <span className="text-xs text-muted-foreground">Balance: {from.balance}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="shrink-0">
              <div className="h-5 w-5 rounded-full bg-primary/20 mr-1.5" />
              {from.symbol}
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Input
              type="number"
              placeholder="0.0"
              value={from.amount}
              onChange={(e) => setFrom({ ...from, amount: e.target.value })}
              className="border-0 bg-transparent text-right text-lg font-medium p-0 h-auto focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSwapDirection}
          >
            <ArrowUpDown className={`h-4 w-4 transition-transform ${rotated ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 dark:bg-muted/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">To</span>
            <span className="text-xs text-muted-foreground">Balance: {to.balance}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="shrink-0">
              <div className="h-5 w-5 rounded-full bg-primary/20 mr-1.5" />
              {to.symbol}
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Input
              type="number"
              placeholder="0.0"
              value={to.amount}
              onChange={(e) => setTo({ ...to, amount: e.target.value })}
              className="border-0 bg-transparent text-right text-lg font-medium p-0 h-auto focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Rate</span>
            <span>1 {from.symbol} = 1,850.00 {to.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span>Price Impact</span>
            <span className="text-green-500 dark:text-green-400">&lt;0.01%</span>
          </div>
          <div className="flex justify-between">
            <span>Min. Received</span>
            <span>— {to.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span>Slippage</span>
            <span>{activeSlippage}%</span>
          </div>
        </div>

        <Button className="w-full" size="lg" disabled={swapping || !from.amount}>
          {swapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {swapping ? 'Swapping...' : 'Swap'}
        </Button>
      </CardContent>
    </Card>
  )
}
