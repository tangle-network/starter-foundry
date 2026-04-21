// Voice agent browser runtime.
//
// Round-trip: press → MediaRecorder captures mic → release → POST blob to
// /api/stt → POST transcript to /api/llm → POST reply to /api/tts → play
// returned audio blob. All three backend routes are contracts documented in
// api/README.md — wire them to Whisper / any LLM via router.tangle.tools /
// ElevenLabs or swap in the provider of your choice.

const talk = document.getElementById('talk') as HTMLButtonElement
const playback = document.getElementById('playback') as HTMLAudioElement
const log = document.getElementById('log') as HTMLPreElement

type State = 'idle' | 'recording' | 'thinking'
let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let currentStream: MediaStream | null = null

function say(line: string): void {
  const ts = new Date().toLocaleTimeString()
  log.textContent = `[${ts}] ${line}\n${log.textContent ?? ''}`.slice(0, 4000)
}

function setState(next: State): void {
  talk.dataset.state = next
  talk.textContent = next === 'recording' ? 'Release to send' : next === 'thinking' ? 'Thinking…' : 'Hold to talk'
  talk.disabled = next === 'thinking'
}

/**
 * Pick a MIME type MediaRecorder will actually accept on this browser.
 * Safari ≤16 rejects `audio/webm` entirely and requires `audio/mp4`;
 * Chrome/Firefox prefer `audio/webm;codecs=opus`. Always feature-detect.
 */
function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  // Let MediaRecorder pick its default — still works on some browsers.
  return undefined
}

async function startRecording(): Promise<void> {
  if (mediaRecorder?.state === 'recording') return

  // getUserMedia prompts the OS permission dialog on first call. The prompt
  // is user-gesture gated: if we're not in a click/touch handler context
  // Safari silently rejects even before showing the prompt.
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    say(`mic denied: ${message}. Check browser permissions and that the page is served over HTTPS.`)
    setState('idle')
    return
  }

  const mimeType = pickMimeType()
  chunks = []
  mediaRecorder = new MediaRecorder(currentStream, mimeType ? { mimeType } : undefined)

  mediaRecorder.addEventListener('dataavailable', (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data)
  })

  mediaRecorder.addEventListener('stop', async () => {
    // Release the mic — otherwise the tab-indicator light stays on and on
    // iOS the device mic stays locked to this page until tab close.
    currentStream?.getTracks().forEach((t) => t.stop())
    currentStream = null

    const mime = mediaRecorder?.mimeType ?? mimeType ?? 'application/octet-stream'
    const blob = new Blob(chunks, { type: mime })
    chunks = []
    await roundTrip(blob)
  })

  mediaRecorder.start()
  setState('recording')
  say(`recording (${mimeType ?? 'default mime'})…`)
}

function stopRecording(): void {
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop()
    setState('thinking')
  }
}

async function roundTrip(audio: Blob): Promise<void> {
  try {
    // 1. STT — raw audio body, never base64 (1.33× bloat).
    say(`→ /api/stt (${audio.size} bytes ${audio.type})`)
    const sttRes = await fetch('/api/stt', {
      method: 'POST',
      headers: { 'content-type': audio.type || 'application/octet-stream' },
      body: audio,
    })
    if (!sttRes.ok) throw new Error(`stt failed: ${sttRes.status}`)
    const { text } = (await sttRes.json()) as { text: string }
    say(`user: ${text}`)

    // 2. LLM — transcript in, reply out.
    const llmRes = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: text }),
    })
    if (!llmRes.ok) throw new Error(`llm failed: ${llmRes.status}`)
    const { reply } = (await llmRes.json()) as { reply: string }
    say(`agent: ${reply}`)

    // 3. TTS — text in, audio bytes out.
    const ttsRes = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: reply }),
    })
    if (!ttsRes.ok) throw new Error(`tts failed: ${ttsRes.status}`)
    const audioBlob = await ttsRes.blob()

    // Playback must start from a same-gesture path on Safari. The button
    // press -> release flow satisfies that — we're still inside the pointer
    // gesture context that started the recording.
    playback.src = URL.createObjectURL(audioBlob)
    await playback.play()
  } catch (err) {
    say(`error: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    setState('idle')
  }
}

// Pointer events unify mouse + touch + pen without the iOS 300ms tap delay.
talk.addEventListener('pointerdown', (ev) => {
  ev.preventDefault()
  void startRecording()
})
talk.addEventListener('pointerup', (ev) => {
  ev.preventDefault()
  stopRecording()
})
talk.addEventListener('pointerleave', () => {
  // Cancel if the user drags off the button rather than releasing on it.
  stopRecording()
})

setState('idle')
