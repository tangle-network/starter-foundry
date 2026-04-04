import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Clock, Users, Rocket } from 'lucide-react'

type SaleStatus = 'upcoming' | 'live' | 'ended' | 'sold-out'

export interface Sale {
  id: string
  name: string
  tokenSymbol: string
  status: SaleStatus
  raised: number
  hardCap: number
  price: string
  totalSupply: string
  vestingSummary: string
  participants: number
  countdown?: string
  logoColor: string
}

const STATUS_CONFIG: Record<SaleStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  upcoming: { variant: 'outline', label: 'Upcoming' },
  live: { variant: 'default', label: 'Live' },
  ended: { variant: 'secondary', label: 'Ended' },
  'sold-out': { variant: 'destructive', label: 'Sold Out' },
}

export function SaleCard({ sale }: { sale: Sale }) {
  const config = STATUS_CONFIG[sale.status]
  const raisedPct = Math.min((sale.raised / sale.hardCap) * 100, 100)

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ backgroundColor: sale.logoColor }}
            >
              {sale.tokenSymbol.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-semibold">{sale.name}</h3>
              <p className="text-sm text-muted-foreground">${sale.tokenSymbol}</p>
            </div>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Raised</span>
            <span className="font-medium">
              ${sale.raised.toLocaleString()} / ${sale.hardCap.toLocaleString()}
            </span>
          </div>
          <Progress value={raisedPct} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">{raisedPct.toFixed(1)}%</p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-medium">{sale.price}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hard Cap</p>
            <p className="font-medium">${sale.hardCap.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Supply</p>
            <p className="font-medium">{sale.totalSupply}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vesting</p>
            <p className="font-medium">{sale.vestingSummary}</p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {sale.participants.toLocaleString()} participants
          </span>
          {sale.countdown && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {sale.countdown}
            </span>
          )}
          {sale.status === 'live' && (
            <span className="flex items-center gap-1.5 text-green-500 dark:text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live Now
            </span>
          )}
        </div>

        <Button className="w-full" disabled={sale.status !== 'live'}>
          <Rocket className="mr-2 h-4 w-4" />
          {sale.status === 'live' ? 'Participate' : sale.status === 'upcoming' ? 'Not Started' : 'Sale Ended'}
        </Button>
      </CardContent>
    </Card>
  )
}
