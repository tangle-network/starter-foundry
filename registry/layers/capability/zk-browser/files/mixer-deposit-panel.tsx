import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Shield, Loader2 } from 'lucide-react'
import { downloadNote, generateNote, type MixerNote } from '@/lib/mixer-note'

export function MixerDepositPanel({ onDeposit }: { onDeposit?: (note: MixerNote) => Promise<void> | void }) {
  const [amount, setAmount] = useState('0.1')
  const [note, setNote] = useState<MixerNote | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeposit = async () => {
    setError(null)
    setBusy(true)
    try {
      const fresh = await generateNote()
      setNote(fresh)
      if (onDeposit) await onDeposit(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'deposit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Deposit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Amount</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.1" />
        </div>
        <Button onClick={handleDeposit} disabled={busy} className="w-full">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? 'Generating commitment…' : 'Generate commitment + deposit'}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {note ? (
          <div className="space-y-2 rounded-lg border p-3 text-xs">
            <div className="font-medium">Note ready — save it to withdraw later</div>
            <div className="break-all">
              <span className="text-muted-foreground">commitment:</span> {note.commitment.slice(0, 16)}…
            </div>
            <div className="break-all">
              <span className="text-muted-foreground">nullifier hash:</span> {note.nullifierHash.slice(0, 16)}…
            </div>
            <Button size="sm" variant="outline" onClick={() => downloadNote(note)} className="w-full">
              <Download className="mr-2 h-3.5 w-3.5" />
              Download note ({amount})
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
