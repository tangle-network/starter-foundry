// Noir prover — Node or browser. Compiles the ACIR circuit (from
// `nargo compile`) into a witness, then hands it to the Barretenberg
// backend for proof generation and verification.
//
// For browser contexts, the Barretenberg WASM loads lazily — first proof
// takes ~3-5 seconds for WASM init, subsequent ones are hundreds of ms.

import { Noir } from '@noir-lang/noir_js'
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg'

// circuit.json is produced by `nargo compile` under circuits/target/.
// Vite / Next / Webpack all support JSON imports via resolve.json
// extension handling.
import circuit from '../../circuits/target/circuit.json' assert { type: 'json' }

export interface ProveResult {
  proof: Uint8Array
  publicInputs: string[]
}

let singletonNoir: Noir | null = null
let singletonBackend: BarretenbergBackend | null = null

function getNoir(): { noir: Noir; backend: BarretenbergBackend } {
  if (!singletonNoir || !singletonBackend) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    singletonBackend = new BarretenbergBackend(circuit as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    singletonNoir = new Noir(circuit as any, singletonBackend)
  }
  return { noir: singletonNoir, backend: singletonBackend }
}

export async function proveSumCommit(
  a: string | number,
  b: string | number,
  expectedSum: string | number,
): Promise<ProveResult> {
  const { noir, backend } = getNoir()
  await noir.init()
  const { witness } = await noir.execute({
    a: String(a),
    b: String(b),
    expected_sum: String(expectedSum),
  })
  const proof = await backend.generateProof(witness)
  return { proof: proof.proof, publicInputs: proof.publicInputs }
}

export async function verifyProof(proof: Uint8Array, publicInputs: string[]): Promise<boolean> {
  const { backend } = getNoir()
  return backend.verifyProof({ proof, publicInputs })
}
