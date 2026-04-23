import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch } from 'lucide-react'

export function MixerMerklePanel({
  root,
  treeSize,
  height,
}: {
  root?: string
  treeSize?: number
  height?: number
}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GitBranch className="h-5 w-5" />
          Merkle State
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Root</div>
          <div className="break-all rounded border bg-muted/30 p-2 font-mono text-xs">
            {root ?? '— (no deposits yet)'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Deposits</div>
            <div className="text-lg font-medium">{treeSize ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Height</div>
            <div className="text-lg font-medium">{height ?? 20}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
