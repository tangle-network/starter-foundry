import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Shield } from 'lucide-react'

export interface Validator {
  name: string
  address: string
  commission: number
  uptime: number
  totalDelegated: string
  delegators: number
  apr: string
  status: 'active' | 'inactive' | 'jailed'
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  jailed: 'destructive',
}

export function ValidatorCard({ validator }: { validator: Validator }) {
  const truncated = `${validator.address.slice(0, 6)}...${validator.address.slice(-4)}`

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm font-semibold">
                {validator.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{validator.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{truncated}</p>
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[validator.status]}>{validator.status}</Badge>
        </div>

        <div className="mb-3">
          <p className="text-3xl font-bold text-green-500 dark:text-green-400">
            {validator.apr}
          </p>
          <p className="text-xs text-muted-foreground">Annual Percentage Rate</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Commission</p>
            <p className="text-sm font-medium">{validator.commission}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" /> Uptime
            </p>
            <p className="text-sm font-medium">{validator.uptime}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" /> Delegators
            </p>
            <p className="text-sm font-medium">{validator.delegators}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>Total Delegated</span>
          <span className="font-medium text-foreground">{validator.totalDelegated}</span>
        </div>

        <Button className="w-full" disabled={validator.status !== 'active'}>
          Delegate
        </Button>
      </CardContent>
    </Card>
  )
}
