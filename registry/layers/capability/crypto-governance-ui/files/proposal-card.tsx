import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Clock, Vote } from 'lucide-react'

type ProposalStatus = 'active' | 'passed' | 'defeated' | 'pending'

export interface Proposal {
  id: number
  title: string
  status: ProposalStatus
  author: string
  createdAt: string
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  quorumPct: number
  timeRemaining: string
}

const STATUS_VARIANT: Record<ProposalStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  passed: 'secondary',
  defeated: 'destructive',
  pending: 'outline',
}

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain
  const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0
  const againstPct = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0
  const abstainPct = totalVotes > 0 ? (proposal.votesAbstain / totalVotes) * 100 : 0
  const truncated = `${proposal.author.slice(0, 6)}...${proposal.author.slice(-4)}`

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">#{proposal.id}</span>
              <Badge variant={STATUS_VARIANT[proposal.status]}>{proposal.status}</Badge>
            </div>
            <h3 className="font-semibold leading-tight line-clamp-2">{proposal.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">{truncated}</span>
          <span>{proposal.createdAt}</span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {proposal.timeRemaining}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="bg-green-500 dark:bg-green-400" style={{ width: `${forPct}%` }} />
            <div className="bg-red-500 dark:bg-red-400" style={{ width: `${againstPct}%` }} />
            <div className="bg-gray-400 dark:bg-gray-500" style={{ width: `${abstainPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="text-green-500 dark:text-green-400">For {forPct.toFixed(1)}%</span>
            <span className="text-red-500 dark:text-red-400">Against {againstPct.toFixed(1)}%</span>
            <span>Abstain {abstainPct.toFixed(1)}%</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Quorum</span>
            <span>{proposal.quorumPct}%</span>
          </div>
          <Progress value={proposal.quorumPct} className="h-1.5" />
        </div>

        {proposal.status === 'active' && (
          <Button className="w-full" size="sm">
            <Vote className="mr-2 h-3.5 w-3.5" />
            Vote
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
