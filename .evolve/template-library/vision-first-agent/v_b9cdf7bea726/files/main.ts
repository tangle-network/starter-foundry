// Vision agent browser runtime.
//
// Flow: getUserMedia({video}) → <video> live preview → user clicks Capture
// → offscreen canvas grabs a JPEG frame → POST {image, prompt} to
// /api/vision → response renders as text + optional bounding boxes on the
// overlay canvas.

interface Box {
  label: string
  x: number
  y: number
  w: number
  h: number
}

interface VisionResponse {
  answer: string
  boxes?: Box[]
}

const cam = document.getElementById('cam') as HTMLVideoElement
const overlay = document.getElementById('overlay') as HTMLCanvasElement
const work = document.getElementById('work') as HTMLCanvasElement
const askBtn = document.getElementById('ask') as HTMLButtonElement
const flipBtn = document.getElementById('flip') as HTMLButtonElement
const q = document.getElementById('q') as HTMLInputElement
const answer = document.getElementById('answer') as HTMLPreElement

let currentStream: MediaStream | null = null
let facing: 'user' | 'environment' = 'environment'

async function startCamera(): Promise<void> {
  // Tear down any previous stream FIRST — the camera LED stays on until
  // every track is explicitly stopped. Just reassigning srcObject leaks the
  // device handle.
  currentStream?.getTracks().forEach((t) => t.stop())

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    answer.textContent = `camera denied: ${message}. Serve over HTTPS and allow camera permission.`
    return
  }

  cam.srcObject = currentStream
  // Wait for metadata so videoWidth/videoHeight are populated before
  // sizing the overlay canvas — 0×0 frames are easy to ship accidentally.
  await new Promise<void>((resolve) => {
    if (cam.readyState >= 1) return resolve()
    cam.addEventListener('loadedmetadata', () => resolve(), { once: true })
  })
  overlay.width = cam.videoWidth
  overlay.height = cam.videoHeight
}

function captureFrame(): string {
  const w = cam.videoWidth
  const h = cam.videoHeight
  if (!w || !h) throw new Error('camera not ready')
  work.width = w
  work.height = h
  const ctx = work.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(cam, 0, 0, w, h)
  // JPEG quality 0.82 is a sweet spot — indistinguishable from 1.0 to the
  // human eye, ~4× smaller payload. PNG is never worth it for camera frames.
  return work.toDataURL('image/jpeg', 0.82)
}

function drawBoxes(boxes: Box[]): void {
  const ctx = overlay.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, overlay.width, overlay.height)
  ctx.lineWidth = Math.max(2, Math.round(overlay.width / 320))
  ctx.strokeStyle = '#5fff85'
  ctx.fillStyle = 'rgba(95, 255, 133, 0.85)'
  ctx.font = `${Math.max(14, Math.round(overlay.width / 48))}px system-ui`
  for (const b of boxes) {
    const x = b.x * overlay.width
    const y = b.y * overlay.height
    const w = b.w * overlay.width
    const h = b.h * overlay.height
    ctx.strokeRect(x, y, w, h)
    const labelPadding = 4
    const metrics = ctx.measureText(b.label)
    const textH = Number.parseInt(ctx.font, 10) + 2
    ctx.fillStyle = '#5fff85'
    ctx.fillRect(x, y - textH - labelPadding, metrics.width + labelPadding * 2, textH + labelPadding)
    ctx.fillStyle = '#000'
    ctx.fillText(b.label, x + labelPadding, y - labelPadding - 2)
    ctx.fillStyle = 'rgba(95, 255, 133, 0.85)'
  }
}

function clearOverlay(): void {
  overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)
}

async function ask(): Promise<void> {
  clearOverlay()
  askBtn.disabled = true
  answer.textContent = 'thinking…'
  try {
    const image = captureFrame()
    const prompt = q.value.trim() || 'What am I looking at?'
    const res = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, prompt }),
    })
    if (!res.ok) throw new Error(`vision failed: ${res.status}`)
    const data = (await res.json()) as VisionResponse
    answer.textContent = data.answer
    if (data.boxes?.length) drawBoxes(data.boxes)
  } catch (err) {
    answer.textContent = `error: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    askBtn.disabled = false
  }
}

askBtn.addEventListener('click', () => void ask())
q.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') void ask()
})
flipBtn.addEventListener('click', () => {
  facing = facing === 'environment' ? 'user' : 'environment'
  void startCamera()
})

window.addEventListener('pagehide', () => {
  currentStream?.getTracks().forEach((t) => t.stop())
})

void startCamera()
