'use client'

import { useState } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

export interface TokenHolding {
  symbol: string
  name: string
  balance: string
  price: string
  value: string
  change: number
  portfolioPct: number
  color: string
}

export function TokenRow({ holding }: { holding: TokenHolding }) {
  const [expanded, setExpanded] = useState(false)
  const isPositive = holding.change >= 0

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: holding.color }}
            >
              {holding.symbol[0]}
            </div>
            <div>
              <p className="text-sm font-medium">{holding.symbol}</p>
              <p className="text-xs text-muted-foreground">{holding.name}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-sm">{holding.balance}</TableCell>
        <TableCell className="text-sm">{holding.price}</TableCell>
        <TableCell className="text-sm font-medium">{holding.value}</TableCell>
        <TableCell>
          <Badge variant="outline" className={isPositive ? 'text-green-500 border-green-200 dark:border-green-800' : 'text-red-500 border-red-200 dark:border-red-800'}>
            {isPositive ? '+' : ''}{holding.change}%
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Progress value={holding.portfolioPct} className="h-1.5 w-16" />
            <span className="text-xs text-muted-foreground">{holding.portfolioPct}%</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 dark:bg-muted/10">
            <div className="flex items-center gap-3 py-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                Transaction History
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
