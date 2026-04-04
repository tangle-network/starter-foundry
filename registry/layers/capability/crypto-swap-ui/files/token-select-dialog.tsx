'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search } from 'lucide-react'

export interface Token {
  symbol: string
  name: string
  balance: string
  color: string
}

const POPULAR = ['ETH', 'USDC', 'USDT', 'WBTC']

const TOKENS: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: '1.234', color: '#627EEA' },
  { symbol: 'USDC', name: 'USD Coin', balance: '500.00', color: '#2775CA' },
  { symbol: 'USDT', name: 'Tether', balance: '250.00', color: '#26A17B' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: '0.05', color: '#F7931A' },
  { symbol: 'DAI', name: 'Dai', balance: '100.00', color: '#F5AC37' },
  { symbol: 'LINK', name: 'Chainlink', balance: '25.0', color: '#2A5ADA' },
]

interface TokenSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (token: Token) => void
}

export function TokenSelectDialog({ open, onOpenChange, onSelect }: TokenSelectDialogProps) {
  const [query, setQuery] = useState('')

  const filtered = TOKENS.filter(
    (t) =>
      t.symbol.toLowerCase().includes(query.toLowerCase()) ||
      t.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or symbol"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR.map((sym) => (
            <Badge
              key={sym}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => {
                const t = TOKENS.find((tk) => tk.symbol === sym)
                if (t) onSelect(t)
              }}
            >
              {sym}
            </Badge>
          ))}
        </div>
        <ScrollArea className="h-64">
          <div className="space-y-1">
            {filtered.map((token) => (
              <button
                key={token.symbol}
                onClick={() => onSelect(token)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: token.color }}
                >
                  {token.symbol[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{token.symbol}</p>
                  <p className="text-xs text-muted-foreground">{token.name}</p>
                </div>
                <span className="text-sm text-muted-foreground">{token.balance}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
