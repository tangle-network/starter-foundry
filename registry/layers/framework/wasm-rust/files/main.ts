// Entry point — initializes the WASM module and wires two samples to the
// DOM. `init()` is synchronous because vite-plugin-top-level-await lets us
// await the wasm-pack loader at the module level.

import init, { greet, fibonacci } from './pkg/{{crateName}}.js'

await init()

const root = document.getElementById('root')!
const n = 40
root.innerHTML = `
  <section style="padding:2rem;font-family:system-ui,sans-serif;max-width:640px;margin:0 auto">
    <h1 style="margin:0 0 0.5rem 0">{{headline}}</h1>
    <p style="margin:0 0 2rem 0;color:#666">{{subheadline}}</p>
    <pre style="background:#f4f4f4;padding:1rem;border-radius:4px">
${greet('{{projectName}}')}
fibonacci(${n}) = ${fibonacci(n)}
    </pre>
    <p style="color:#666;font-size:0.85rem">
      Both lines above were computed by Rust compiled to WASM. Edit
      <code>src/lib.rs</code> and re-run <code>pnpm run build:wasm</code>.
    </p>
  </section>
`
