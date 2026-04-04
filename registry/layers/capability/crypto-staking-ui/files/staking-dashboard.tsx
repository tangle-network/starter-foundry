'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Coins, TrendingUp, Clock, Gift } from 'lucide-react'

interface Position {
  validator: string
  amount: string
  rewards: string
  apr: string
  status: 'active' | 'unstaking'
}

const POSITIONS: Position[] = [
  { validator: 'Figment', amount: '32.0 ETH', rewards: '1.24 ETH', apr: '4.2%', status: 'active' },
  { validator: 'Lido', amount: '10.0 ETH', rewards: '0.38 ETH', apr: '3.9%', status: 'active' },
  { validator: 'Rocket Pool', amount: '5.0 ETH', rewards: '0.12 ETH', apr: '4.5%', status: 'unstaking' },
]

export function StakingDashboard() {
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')

  const stats = [
    { label: 'Total Staked', value: '47.0 ETH', icon: Coins },
    { label: 'Rewards Earned', value: '1.74 ETH', icon: Gift },
    { label: 'Current APR', value: '4.2%', icon: TrendingUp },
    { label: 'Next Reward', value: '~12h', icon: Clock },
  ]

  return (
    <div className="space-y-6">
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

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="stake">
            <TabsList className="mb-4">
              <TabsTrigger value="stake">Stake</TabsTrigger>
              <TabsTrigger value="unstake">Unstake</TabsTrigger>
            </TabsList>
            <TabsContent value="stake" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setStakeAmount('47.0')}
                  >
                    MAX
                  </Button>
                </div>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                />
              </div>
              {stakeAmount && (
                <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Est. Annual Reward</span>
                    <span className="text-green-500 dark:text-green-400">
                      ~{(parseFloat(stakeAmount) * 0.042).toFixed(3)} ETH
                    </span>
                  </div>
                </div>
              )}
              <Button className="w-full" disabled={!stakeAmount}>Stake</Button>
            </TabsContent>
            <TabsContent value="unstake" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setUnstakeAmount('47.0')}
                  >
                    MAX
                  </Button>
                </div>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Cooldown period: ~7 days before funds are withdrawable.
              </div>
              <Button className="w-full" variant="outline" disabled={!unstakeAmount}>
                Unstake
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Validator</TableHead>
                <TableHead>Staked</TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead>APR</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {POSITIONS.map((pos) => (
                <TableRow key={pos.validator}>
                  <TableCell className="font-medium">{pos.validator}</TableCell>
                  <TableCell>{pos.amount}</TableCell>
                  <TableCell className="text-green-500 dark:text-green-400">{pos.rewards}</TableCell>
                  <TableCell>{pos.apr}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant={pos.status === 'active' ? 'default' : 'secondary'}>
                        {pos.status}
                      </Badge>
                      <Button size="sm" variant="outline">Claim</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
