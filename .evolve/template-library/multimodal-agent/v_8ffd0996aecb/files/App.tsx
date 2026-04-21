// Three-modality composer.
//
// Text, image, and audio are three independent state machines intentionally
// kept in separate useState hooks so a change in one never stomps the
// others. The Send handler is the only place they converge — it packs
// whatever is currently present into a single FormData and POSTs it.

import { useCallback, useEffect, useRef, useState } from 'react'

type SendState = 'idle' | 'sending'

export default function App() {
  const [text, setText] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [audio, setAudio] = useState<Blob | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [sendState, setSendState] = useState<SendState>('idle')
  const [out, setOut] = useState('Drop an image, record 3 seconds of audio, type your question.')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Previews are ObjectURLs — revoke on replacement AND on unmount or
  // Chrome silently retains the blob until a full GC cycle.
  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
  }, [imagePreview])
  useEffect(() => () => {
    if (audioPreview) URL.revokeObjectURL(audioPreview)
  }, [audioPreview])

  // On unmount, kill any live mic stream. React 19 StrictMode double-invokes
  // effects in dev, so this also catches the "recording started, effect
  // re-ran" race.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  function assignImage(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImage(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    // Must read files synchronously — Safari clears dataTransfer once the
    // handler returns, even if you await inside it.
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) assignImage(file)
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    // preventDefault here is MANDATORY — without it the browser navigates
    // away to the file URL and the drop event never fires.
    e.preventDefault()
    setDragActive(true)
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
  }

  async function startRecord() {
    if (recording) return
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setOut(`mic denied: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    const mime =
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
    chunksRef.current = []
    mediaRef.current = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined)
    mediaRef.current.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data)
    }
    mediaRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mediaRef.current?.mimeType ?? 'audio/webm' })
      if (audioPreview) URL.revokeObjectURL(audioPreview)
      setAudio(blob)
      setAudioPreview(URL.createObjectURL(blob))
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRef.current.start()
    setRecording(true)
  }

  function stopRecord() {
    mediaRef.current?.state === 'recording' && mediaRef.current.stop()
    setRecording(false)
  }

  const clearAudio = useCallback(() => {
    if (audioPreview) URL.revokeObjectURL(audioPreview)
    setAudio(null)
    setAudioPreview(null)
  }, [audioPreview])

  async function send() {
    if (sendState === 'sending') return
    if (!text && !image && !audio) {
      setOut('add at least one of: text, image, audio.')
      return
    }
    setSendState('sending')
    setOut('sending…')
    try {
      const form = new FormData()
      form.set('text', text)
      if (image) form.set('image', image, image.name)
      if (audio) form.set('audio', audio, `clip.${(audio.type.split('/')[1] ?? 'webm').split(';')[0]}`)

      const res = await fetch('/api/multimodal', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`multimodal failed: ${res.status}`)

      // Handle both non-streamed JSON and streamed NDJSON transparently.
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const { reply } = (await res.json()) as { reply: string }
        setOut(reply)
      } else {
        const reader = res.body?.getReader()
        if (!reader) {
          setOut(await res.text())
        } else {
          const decoder = new TextDecoder()
          let acc = ''
          setOut('')
          // Stream loop — flush each chunk straight to the output pre
          // element so users see tokens as they arrive.
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            acc += decoder.decode(value, { stream: true })
            setOut(acc)
          }
        }
      }
    } catch (err) {
      setOut(`error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSendState('idle')
    }
  }

  return (
    <>
      <h1>{'{{headline}}'}</h1>
      <p className="sub">{'{{subheadline}}'}</p>

      <div className="panels">
        <section className="panel">
          <h3>Text</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your question. Empty is fine if image/audio is enough."
          />
        </section>

        <section className="panel">
          <h3>Image</h3>
          <div
            className={`drop ${dragActive ? 'active' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => document.getElementById('file-pick')?.click()}
          >
            {imagePreview ? <img src={imagePreview} alt="" /> : 'Drop or click to choose an image'}
          </div>
          <input
            id="file-pick"
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => assignImage(e.target.files?.[0] ?? null)}
          />
          {image && (
            <button className="danger" onClick={() => assignImage(null)}>
              Remove
            </button>
          )}
        </section>

        <section className="panel">
          <h3>Audio</h3>
          {!audio && (
            <button onClick={recording ? stopRecord : startRecord}>
              {recording ? <span className="recording">Stop recording</span> : 'Start recording'}
            </button>
          )}
          {audioPreview && <audio src={audioPreview} controls />}
          {audio && (
            <button className="danger" onClick={clearAudio}>
              Re-record
            </button>
          )}
          {!audio && !recording && <span className="pill">webm/opus preferred</span>}
        </section>
      </div>

      <button className="send" onClick={send} disabled={sendState === 'sending'}>
        {sendState === 'sending' ? 'Thinking…' : 'Send all three'}
      </button>

      <pre id="out">{out}</pre>
    </>
  )
}
