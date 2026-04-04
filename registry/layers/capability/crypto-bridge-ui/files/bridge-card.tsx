'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeftRight, ArrowRight, Loader2 } from 'lucide-react'

interface Chain {
  id: string
  name: string
  color: string
}

const CHAINS: Chain[] = [
  { id: 'ethereum', name: 'Ethereum', color: '#627EEA' },
  { id: 'arbitrum', name: 'Arbitrum', color: '#28A0F0' },
  { id: 'optimism', name: 'Optimism', color: '#FF0420' },
  { id: 'polygon', name: 'Polygon', color: '#8247E5' },
  { id: 'base', name: 'Base', color: '#0052FF' },
]

export function BridgeCard() {
  const [sourceChain, setSourceChain] = useState('ethereum')
  const [destChain, setDestChain] = useState('arbitrum')
  const [token, setToken] = useState('ETH')
  const [amount, setAmount] = useState('')
  const [bridging, setBridging] = useState(false)

  const handleSwapChains = () => {
    setSourceChain(destChain)
    setDestChain(sourceChain)
  }

  const source = CHAINS.find((c) => c.id === sourceChain)
  const dest = CHAINS.find((c) => c.id === destChain)

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Bridge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1.5">From</p>
            <Select value={sourceChain} onValueChange={setSourceChain}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: chain.color }}
                      />
                      {chain.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mt-5 h-8 w-8 shrink-0"
            onClick={handleSwapChains}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1.5">To</p>
            <Select value={destChain} onValueChange={setDestChain}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: chain.color }}
                      />
                      {chain.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Token & Amount</span>
            <span className="text-xs text-muted-foreground">Balance: 1.234 {token}</span>
          </div>
          <div className="flex gap-2">
            <Select value={token} onValueChange={setToken}>
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ETH">ETH</SelectItem>
                <SelectItem value="USDC">USDC</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: source?.color }} />
            <span>{source?.name}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5" />
          <Badge variant="secondary" className="text-xs">Bridge Protocol</Badge>
          <ArrowRight className="h-3.5 w-3.5" />
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: dest?.color }} />
            <span>{dest?.name}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Bridge Fee</span>
            <span>~0.001 ETH</span>
          </div>
          <div className="flex justify-between">
            <span>Gas Estimate</span>
            <span>~$2.50</span>
          </div>
          <div className="flex justify-between">
            <span>Estimated Time</span>
            <span>~10 min</span>
          </div>
        </div>

        <Button className="w-full" size="lg" disabled={bridging || !amount}>
          {bridging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {bridging ? 'Bridging...' : 'Bridge'}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Funds will arrive on {dest?.name} after confirmation.
        </p>
      </CardContent>
    </Card>
  )
}
