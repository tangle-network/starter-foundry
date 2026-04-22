import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { parseNote, verifyNote, type MixerNote } from '@/lib/mixer-note'

type Result = { ok: boolean; note: MixerNote | null; reason?: string }

export function MixerVerifyPanel() {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    setResult(null)
    const raw = await file.text()
    const parsed = parseNote(raw)
    if (!parsed) {
      setResult({ ok: false, note: null, reason: 'Not a valid note file' })
      setBusy(false)
      return
    }
    const ok = await verifyNote(parsed)
    setResult({ ok, note: parsed, reason: ok ? undefined : 'Commitment does not match nullifier+secret' })
    setBusy(false)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Verify Your Note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Drop the JSON note you downloaded after deposit. We recompute the commitment locally to confirm the file is intact and the secret hasn't been tampered with.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full" disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload note to verify
        </Button>
        {result ? (
          <div className={result.ok ? 'flex items-start gap-2 rounded border border-green-500/40 bg-green-500/5 p-3 text-sm' : 'flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm'}>
            {result.ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
            <div>
              <div className="font-medium">{result.ok ? 'Note verified' : 'Invalid note'}</div>
              {result.reason ? <div className="text-xs text-muted-foreground">{result.reason}</div> : null}
              {result.note ? (
                <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  commitment {result.note.commitment.slice(0, 24)}…
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
