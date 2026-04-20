# ZK circuits — browser-side proof generation

This scaffold ships with `snarkjs` + `circomlibjs` + `circomlib` installed.
Proofs are generated client-side (in the browser), not on a dedicated prover
service. Use this for:

- Mixers (deposit commitment / withdraw with nullifier-preimage)
- Anonymous credentials / private voting
- Zero-knowledge set-membership proofs
- Any product where the user generates a proof about their own private data

**Not this:** if you need to prove arbitrary RISC-V or Rust programs, use
`framework:zk-prover-service` (sp1 / risc0) instead. That runs on a server;
this runs in the user's browser.

## Writing a circuit

1. Create `circuits/<name>.circom`. Start from circomlib primitives:

   ```circom
   pragma circom 2.1.5;
   include "../node_modules/circomlib/circuits/poseidon.circom";
   include "../node_modules/circomlib/circuits/merkletree.circom";

   template Mixer(levels) {
     // ...
   }

   component main { public [ root, nullifierHash ] } = Mixer(20);
   ```

2. Compile: `circom circuits/mixer.circom --r1cs --wasm --sym -o build/`

3. Trusted setup (one-time per circuit):
   ```bash
   snarkjs groth16 setup build/mixer.r1cs powersOfTau28_hez_final_15.ptau mixer_0000.zkey
   snarkjs zkey contribute mixer_0000.zkey mixer_final.zkey --name="your-org"
   snarkjs zkey export verificationkey mixer_final.zkey public/verification_key.json
   ```

4. Host the proving artifacts:
   - `public/proving-keys/mixer.wasm` — the circuit wasm
   - `public/proving-keys/mixer.zkey` — the proving key (multi-MB — use a CDN)
   - `public/verification_key.json` — the verification key (for client-side verify)

## Generating a proof in the app

```ts
import { generateProof } from '@/lib/zkproof'

const { proof, publicSignals, solidityCalldata } = await generateProof(
  {
    secret: secretNullifier,
    pathElements: merklePath,
    pathIndices: pathDirection,
    root: merkleRoot,
    nullifierHash: poseidonHash([nullifier]),
  },
  '/proving-keys/mixer.wasm',
  '/proving-keys/mixer.zkey',
)

// Submit to your on-chain verifier:
await mixerContract.withdraw(solidityCalldata)
```

## Performance notes

- Browser proof generation takes 1-5 seconds depending on circuit size — show
  a loading state. Consider a Web Worker so the main thread stays responsive.
- Proving keys are typically 1-20 MB per circuit. Put them behind a CDN.
- `circomlibjs` is CommonJS; if you hit ESM interop errors, add
  `optimizeDeps.include: ['circomlibjs']` to your `vite.config.ts`.
