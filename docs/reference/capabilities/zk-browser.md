# Capability: `capability:zk-browser`

Client-side ZK proof generation — snarkjs + circomlibjs + circomlib, a zkProof helper, and notes on hosting the proving key. For browser-native mixers, private voting, anonymous credentials, and any product where proofs are generated in the browser instead of on a Rust prover service.

**Applies to**: react-vite-ts, nextjs-ts, fullstack-ts, remix-ts, sveltekit-ts, vue-ts

## When to use

Attach for products that generate ZK proofs client-side (browser): mixers, private voting, anonymous credentials, commitment-nullifier flows. NOT for server-side provers (use framework:zk-prover-service with sp1/risc0 instead).

## Shipped deps

- `snarkjs`: ^0.7.5
- `circomlibjs`: ^0.1.7
- `circomlib`: ^2.0.5

## First moves

- Compile your circuit with circom: circom mixer.circom --r1cs --wasm --sym -o build/
- Generate proving + verification keys (trusted setup): snarkjs groth16 setup ...
- Host the proving key + wasm under public/proving-keys/ so the browser can fetch them at proof time
- Use src/lib/zkproof.ts as the entry point: await generateProof(circuitInputs, wasmUrl, zkeyUrl)

## Gotchas

- Proving keys are multi-MB — host them as static files (CDN recommended), not bundled into JS.
- Browser proof generation takes 1-5s depending on circuit size — show a loading UI.
- circomlibjs is CommonJS — may need Vite/webpack interop config for ESM consumers.
