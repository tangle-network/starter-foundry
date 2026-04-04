import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export interface Pool {
  id: string
  tokenA: { symbol: string; color: string }
  tokenB: { symbol: string; color: string }
  feeTier: string
  tvl: string
  volume24h: string
  apr: string
  userShare?: {
    percentage: string
    amountA: string
    amountB: string
  }
}

export function PoolCard({ pool }: { pool: Pool }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-background"
                style={{ backgroundColor: pool.tokenA.color }}
              >
                {pool.tokenA.symbol[0]}
              </div>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-background"
                style={{ backgroundColor: pool.tokenB.color }}
              >
                {pool.tokenB.symbol[0]}
              </div>
            </div>
            <span className="font-semibold">
              {pool.tokenA.symbol}/{pool.tokenB.symbol}
            </span>
          </div>
          <Badge variant="secondary">{pool.feeTier}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">TVL</p>
            <p className="text-sm font-medium">{pool.tvl}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volume 24h</p>
            <p className="text-sm font-medium">{pool.volume24h}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">APR</p>
            <p className="text-sm font-medium text-green-500 dark:text-green-400">{pool.apr}</p>
          </div>
        </div>

        {pool.userShare && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Your Position</p>
              <div className="flex items-center justify-between text-sm">
                <span>Share: {pool.userShare.percentage}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{pool.userShare.amountA} {pool.tokenA.symbol}</span>
                <span>{pool.userShare.amountB} {pool.tokenB.symbol}</span>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <Button className="flex-1" size="sm">
            Add Liquidity
          </Button>
          {pool.userShare && (
            <Button variant="outline" className="flex-1" size="sm">
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
