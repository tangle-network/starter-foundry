# Capability: `capability:tangle-tee`

TEE (Trusted Execution Environment) blueprint capability — operators run jobs inside an enclave (Intel TDX / AWS Nitro / Phala dStack) and produce a remote-attestation-backed proof. Apply to tangle-blueprint for private-compute, confidential data processing, or regulated workload jobs.

**Applies to**: tangle-blueprint

## When to use

Attach when the blueprint must run in an enclave — handling private keys, regulated PII, or producing attested outputs for downstream trust.

## First moves

- Pick a backend in tee-config.json (intel-tdx | aws-nitro | phala-dstack)
- Wire the attestation verifier in your job's verify_result.rs
- Emit the RA quote alongside the job output
