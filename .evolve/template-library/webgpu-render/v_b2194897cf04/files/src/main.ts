// Raw WebGPU rendering bootstrap — no engine, no abstraction.
// adapter → device → canvas context → render pipeline → render loop.

import mainWgsl from './shaders/main.wgsl?raw'

const canvas = document.getElementById('scene') as HTMLCanvasElement
const statusEl = document.getElementById('status') as HTMLDivElement
if (!canvas) throw new Error('#scene canvas missing from index.html')

function setStatus(msg: string, cls: '' | 'err' = ''): void {
  statusEl.textContent = msg
  statusEl.className = cls
}

async function run(): Promise<void> {
  if (!('gpu' in navigator)) {
    throw new Error('navigator.gpu unavailable — use Chrome 113+, Edge 113+, Safari 18+, or enable dom.webgpu.enabled in Firefox.')
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error('requestAdapter() returned null — GPU may be blocklisted or disabled in this browser profile.')
  }

  const device = await adapter.requestDevice()
  device.lost.then((info) => {
    setStatus(`GPUDevice lost: ${info.reason} — ${info.message}`, 'err')
  })

  const context = canvas.getContext('webgpu') as GPUCanvasContext | null
  if (!context) throw new Error('canvas.getContext("webgpu") returned null')

  // Preferred format must match between context.configure and the
  // pipeline's fragment target — store once, reuse.
  const format = navigator.gpu.getPreferredCanvasFormat()

  function configureSwapchain(): void {
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr))
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr))
    context!.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    })
  }
  configureSwapchain()

  const shaderModule = device.createShaderModule({ code: mainWgsl })
  const compilation = await shaderModule.getCompilationInfo()
  for (const msg of compilation.messages) {
    if (msg.type === 'error') {
      throw new Error(`WGSL compile error at ${msg.lineNum}:${msg.linePos}: ${msg.message}`)
    }
  }

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule, entryPoint: 'vs_main' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  })

  let rafHandle = 0
  function frame(): void {
    const view = context!.getCurrentTexture().createView()
    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0.043, g: 0.051, b: 0.063, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.draw(3, 1, 0, 0)
    pass.end()
    device.queue.submit([encoder.finish()])
    rafHandle = requestAnimationFrame(frame)
  }
  frame()

  function onResize(): void {
    configureSwapchain()
  }
  window.addEventListener('resize', onResize)

  const adapterInfo = (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info
  const vendor = adapterInfo?.vendor ?? 'unknown'
  const arch = adapterInfo?.architecture ?? 'unknown'
  setStatus(`WebGPU ${vendor}/${arch} · format ${format}`)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cancelAnimationFrame(rafHandle)
      window.removeEventListener('resize', onResize)
      device.destroy()
    })
  }
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  setStatus(`Fatal: ${message}`, 'err')
  console.error(err)
})
