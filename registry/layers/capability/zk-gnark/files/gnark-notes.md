# ConsenSys gnark

Go-native ZK framework. Circuits are Go structs; prover + verifier run in
regular Go code. Strongest fit for backend services where the prover IS the
service (ZK-rollup sequencer, aggregator, verifier oracle).

## Layout

```
circuit.go    # struct implementing frontend.Circuit with public + private fields
prover.go     # Setup() / Prove() / Verify() — wire into your HTTP or worker layer
```

## Visibility

```go
type MyCircuit struct {
    Secret      frontend.Variable `gnark:",secret"`  // private
    PublicValue frontend.Variable `gnark:",public"`  // public
    Default     frontend.Variable                    // defaults to secret
}
```

Public fields show up in the `publicWitness` used by the verifier; private
ones do not.

## Constraint APIs

Use `api.*` — bare Go ops don't constrain:

| API | What it does |
|---|---|
| `api.Add(a, b)` | addition constraint |
| `api.Mul(a, b)` | multiplication |
| `api.AssertIsEqual(a, b)` | fails proof if a != b |
| `api.AssertIsBoolean(v)` | fails if v ∉ {0,1} |
| `api.Select(cond, ifTrue, ifFalse)` | constant-time conditional |
| `api.IsZero(v)` | returns 1 if v==0, 0 otherwise |
| `api.ToBinary(v, n)` | n-bit decomposition |

## Proof systems

| System | Proof size | Setup | Use case |
|---|---|---|---|
| Groth16 | ~200 bytes | per-circuit trusted | on-chain verification, smallest footprint |
| Plonk | ~5-10 KB | universal trusted (or KZG-SRS) | circuit changes without re-ceremony |
| Plonk + KZG | ~5 KB | universal SRS | EIP-4844 alignment, cheaper on EVM |

## Ceremony discipline

For Groth16 in production:

1. Run the trusted setup ONCE. Generate `pk.bin` + `vk.bin`.
2. Distribute pk.bin to prover nodes, vk.bin to verifier / smart-contract.
3. Never regenerate in production. Regenerating invalidates all prior proofs.

For dev:

```go
cs, pk, vk, err := Setup()  // re-ceremony every restart — dev only
```

## EVM verification

Gnark ships Solidity verifier codegen:

```bash
go run github.com/consensys/gnark/gnarksolidity -vk vk.bin -out Verifier.sol
```

Drop the resulting Verifier.sol into foundry/hardhat, call `Verifier.verifyProof(...)`
from your application contract.

## Gotchas

- **Witness field matching is by name**, not order. Rename the circuit struct
  field, you MUST rename the assignment struct field — else silent mismatch.
- **Big int handling**: `frontend.Variable` accepts Go ints, big.Int, strings.
  For values > 2^63, pass big.Int — ints overflow silently.
- **Proof serialization**: `proof.WriteTo(buf)` is canonical. Don't JSON-serialize the proof object; the binary format is 10× more compact.
