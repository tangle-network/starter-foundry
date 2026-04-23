import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { parseNote, verifyNote, type MixerNote } from '@/lib/mixer-note'
import { generateProof } from '@/lib/zkproof'

type Status = 'idle' | 'verifying' | 'proving' | 'ready' | 'error'

export function MixerWithdrawPanel({
  wasmUrl,
  zkeyUrl,
  onSubmit,
}: {
  wasmUrl?: string
  zkeyUrl?: string
  onSubmit?: (args: { note: MixerNote; recipient: string; proof: string; publicSignals: string[] }) => Promise<void> | void
}) {
  const [note, setNote] = useState<MixerNote | null>(null)
  const [recipient, setRecipient] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setStatus('verifying')
    setMessage(null)
    const raw = await file.text()
    const parsed = parseNote(raw)
    if (!parsed) {
      setStatus('error')
      setMessage('Invalid note file')
      return
    }
    const ok = await verifyNote(parsed)
    if (!ok) {
      setStatus('error')
      setMessage('Note commitment does not match — file may be corrupted')
      return
    }
    setNote(parsed)
    setStatus('idle')
    setMessage('Note verified')
  }

  const handleWithdraw = async () => {
    if (!note || !recipient) return
    setStatus('proving')
    setMessage(null)
    try {
      if (!wasmUrl || !zkeyUrl) {
        throw new Error('wasmUrl + zkeyUrl required — wire them from env or props')
      }
      const proof = await generateProof(
        { nullifier: note.nullifier, secret: note.secret, recipient },
        wasmUrl,
        zkeyUrl,
      )
      setStatus('ready')
      if (onSubmit) await onSubmit({ note, recipient, proof: proof.solidityCalldata, publicSignals: proof.publicSignals })
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'proof generation failed')
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Withdraw</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Note file</label>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            {note ? `Note: ${note.commitment.slice(0, 10)}…` : 'Upload note'}
          </Button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Recipient address</label>
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" />
        </div>
        <Button onClick={handleWithdraw} disabled={!note || !recipient || status === 'proving'} className="w-full">
          {status === 'proving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {status === 'proving' ? 'Generating proof…' : 'Generate proof + withdraw'}
        </Button>
        {message ? (
          <p className={status === 'error' ? 'flex items-center gap-1.5 text-sm text-destructive' : 'flex items-center gap-1.5 text-sm text-green-600'}>
            {status === 'error' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
