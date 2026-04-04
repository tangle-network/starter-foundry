import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Gift } from 'lucide-react'

export interface VestingMilestone {
  date: string
  unlockPct: number
  cumulativePct: number
  label: string
}

export interface VestingInfo {
  tgeUnlockPct: number
  cliffMonths: number
  vestingMonths: number
  milestones: VestingMilestone[]
  currentIndex: number
  claimableAmount: string
  tokenSymbol: string
}

export function VestingSchedule({ vesting }: { vesting: VestingInfo }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Vesting Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">TGE Unlock</p>
            <p className="text-sm font-semibold">{vesting.tgeUnlockPct}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cliff</p>
            <p className="text-sm font-semibold">{vesting.cliffMonths}mo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vesting</p>
            <p className="text-sm font-semibold">{vesting.vestingMonths}mo linear</p>
          </div>
        </div>

        <Separator />

        <div className="relative space-y-0">
          {vesting.milestones.map((milestone, idx) => {
            const isCurrent = idx === vesting.currentIndex
            const isPast = idx < vesting.currentIndex

            return (
              <div key={milestone.date} className="flex items-start gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full border-2 ${
                    isCurrent
                      ? 'border-primary bg-primary'
                      : isPast
                        ? 'border-primary/50 bg-primary/50'
                        : 'border-muted-foreground/30 bg-background'
                  }`} />
                  {idx < vesting.milestones.length - 1 && (
                    <div className={`w-0.5 flex-1 min-h-[24px] ${
                      isPast ? 'bg-primary/50' : 'bg-muted-foreground/20'
                    }`} />
                  )}
                </div>
                <div className="flex-1 -mt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{milestone.label}</span>
                    {isCurrent && <Badge variant="default" className="text-xs">Current</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                    <span>{milestone.date}</span>
                    <span>{milestone.unlockPct}% unlock ({milestone.cumulativePct}% total)</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Claimable</p>
            <p className="text-lg font-semibold">
              {vesting.claimableAmount} {vesting.tokenSymbol}
            </p>
          </div>
          <Button disabled={vesting.claimableAmount === '0'}>
            <Gift className="mr-2 h-4 w-4" />
            Claim
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
