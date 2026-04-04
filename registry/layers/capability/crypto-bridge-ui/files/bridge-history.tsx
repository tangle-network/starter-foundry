import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

type BridgeStatus = 'pending' | 'confirming' | 'completed' | 'failed'

export interface BridgeTransaction {
  id: string
  token: string
  amount: string
  fromChain: string
  toChain: string
  status: BridgeStatus
  confirmations?: string
  time: string
  txHash: string
}

const STATUS_CONFIG: Record<BridgeStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending: { variant: 'outline', label: 'Pending' },
  confirming: { variant: 'secondary', label: 'Confirming' },
  completed: { variant: 'default', label: 'Completed' },
  failed: { variant: 'destructive', label: 'Failed' },
}

const DEMO_TXS: BridgeTransaction[] = [
  { id: '1', token: 'ETH', amount: '0.5', fromChain: 'Ethereum', toChain: 'Arbitrum', status: 'completed', time: '2h ago', txHash: '0xabc...123' },
  { id: '2', token: 'USDC', amount: '1000', fromChain: 'Arbitrum', toChain: 'Base', status: 'confirming', confirmations: '4/12', time: '15m ago', txHash: '0xdef...456' },
  { id: '3', token: 'ETH', amount: '1.0', fromChain: 'Ethereum', toChain: 'Optimism', status: 'pending', time: '2m ago', txHash: '0xghi...789' },
]

export function BridgeHistory({ transactions = DEMO_TXS }: { transactions?: BridgeTransaction[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Token</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-right">Tx</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const config = STATUS_CONFIG[tx.status]
            return (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">{tx.token}</TableCell>
                <TableCell>{tx.amount}</TableCell>
                <TableCell>{tx.fromChain}</TableCell>
                <TableCell>{tx.toChain}</TableCell>
                <TableCell>
                  <Badge variant={config.variant}>
                    {config.label}
                    {tx.confirmations && ` (${tx.confirmations})`}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{tx.time}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                    {tx.txHash}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
          {transactions.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No bridge transactions yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
