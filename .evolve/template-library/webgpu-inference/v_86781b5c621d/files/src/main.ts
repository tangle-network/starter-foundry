// WebGPU compute bootstrap — runs a matmul WGSL kernel end-to-end:
// adapter → device → buffers → bind group → pipeline → dispatch → readback.
//
// Alternative production path (commented below): Transformers.js auto-
// detects WebGPU and serves ONNX models via `pipeline()`. Swap in when
// you need real models instead of a hand-written kernel.

import matmulWgsl from './shaders/matmul.wgsl?raw'

const statusEl = document.getElementById('status') as HTMLDivElement
const outputEl = document.getElementById('output') as HTMLPreElement

function setStatus(msg: string, cls: 'ok' | 'err' | '' = ''): void {
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

  // --- Inputs: a 4x4 identity-ish matrix @ a 4x4 ramp. Result should be
  // predictable: for the identity case, C == B.
  const M = 4, N = 4, K = 4
  const a = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
  const b = new Float32Array([
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16,
  ])

  // --- Buffers. STORAGE for shader access, COPY_SRC on the output so we
  // can read it back via a staging buffer.
  const dimsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(dimsBuffer, 0, new Uint32Array([M, N, K, 0]))

  const aBuffer = device.createBuffer({
    size: a.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(aBuffer, 0, a)

  const bBuffer = device.createBuffer({
    size: b.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(bBuffer, 0, b)

  const cByteLength = M * N * 4
  const cBuffer = device.createBuffer({
    size: cByteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })

  const stagingBuffer = device.createBuffer({
    size: cByteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })

  // --- Shader + pipeline. Surface WGSL compile errors loudly; silent
  // NaNs are the worst failure mode when the shader is broken.
  const shaderModule = device.createShaderModule({ code: matmulWgsl })
  const compilation = await shaderModule.getCompilationInfo()
  for (const msg of compilation.messages) {
    if (msg.type === 'error') {
      throw new Error(`WGSL compile error at ${msg.lineNum}:${msg.linePos}: ${msg.message}`)
    }
  }

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: shaderModule, entryPoint: 'main' },
  })

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: dimsBuffer } },
      { binding: 1, resource: { buffer: aBuffer } },
      { binding: 2, resource: { buffer: bBuffer } },
      { binding: 3, resource: { buffer: cBuffer } },
    ],
  })

  // --- Dispatch. Workgroup size (8,8,1) covers an 8x8 tile; ceilDiv so
  // partial tiles still run with the in-shader bounds check.
  const WG_X = 8, WG_Y = 8
  const gx = Math.ceil(M / WG_X)
  const gy = Math.ceil(N / WG_Y)

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(gx, gy, 1)
  pass.end()
  encoder.copyBufferToBuffer(cBuffer, 0, stagingBuffer, 0, cByteLength)
  device.queue.submit([encoder.finish()])

  await stagingBuffer.mapAsync(GPUMapMode.READ)
  const result = new Float32Array(stagingBuffer.getMappedRange().slice(0))
  stagingBuffer.unmap()

  const adapterInfo = (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info
  const vendor = adapterInfo?.vendor ?? 'unknown'
  const arch = adapterInfo?.architecture ?? 'unknown'

  setStatus(`WebGPU ready — adapter ${vendor}/${arch}. Matmul dispatched (${gx}x${gy} workgroups).`, 'ok')

  const rows: string[] = []
  rows.push(`A (${M}x${K}):\n${formatMatrix(a, M, K)}`)
  rows.push(`B (${K}x${N}):\n${formatMatrix(b, K, N)}`)
  rows.push(`C = A @ B (${M}x${N}):\n${formatMatrix(result, M, N)}`)
  outputEl.textContent = rows.join('\n\n')
}

function formatMatrix(m: Float32Array, rows: number, cols: number): string {
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    const row: string[] = []
    for (let c = 0; c < cols; c++) {
      row.push(m[r * cols + c].toFixed(2).padStart(7))
    }
    lines.push(row.join(' '))
  }
  return lines.join('\n')
}

// --- Alternative production path: Transformers.js over WebGPU.
// Uncomment after `pnpm add @huggingface/transformers`. It auto-detects
// WebGPU and falls back to WASM SIMD when unavailable, so you get one
// code path across every browser.
//
// import { pipeline } from '@huggingface/transformers'
// const classifier = await pipeline(
//   'sentiment-analysis',
//   'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
//   { device: 'webgpu' },
// )
// const out = await classifier('WebGPU in the browser is a game changer.')
// console.log(out)

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  setStatus(`Fatal: ${message}`, 'err')
  console.error(err)
})
