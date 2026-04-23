// Gnark prover. Compiles the circuit into an R1CS, runs Groth16 trusted
// setup (keep the trusted-setup artifacts out of source control for
// production — generate once, load thereafter), then exposes Prove / Verify
// functions suitable for wrapping in an HTTP handler or worker job.

package main

import (
	"bytes"
	"fmt"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
)

// Setup compiles the circuit and produces the proving+verifying keys.
// In production, do this once (a trusted-setup ceremony) and persist the
// keys to disk/secret store; NEVER regenerate per request.
func Setup() (constraintSystem frontend.CompiledConstraintSystem, pk groth16.ProvingKey, vk groth16.VerifyingKey, err error) {
	var circuit SumCircuit
	constraintSystem, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &circuit)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("compile: %w", err)
	}
	pk, vk, err = groth16.Setup(constraintSystem)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("setup: %w", err)
	}
	return constraintSystem, pk, vk, nil
}

// Prove produces a Groth16 proof for the given (A, B, ExpectedSum) witness.
// Returns serialized proof bytes suitable for transport / on-chain submission.
func Prove(cs frontend.CompiledConstraintSystem, pk groth16.ProvingKey, a, b, expectedSum int64) ([]byte, error) {
	assignment := &SumCircuit{
		A:           a,
		B:           b,
		ExpectedSum: expectedSum,
	}
	witness, err := frontend.NewWitness(assignment, ecc.BN254.ScalarField())
	if err != nil {
		return nil, fmt.Errorf("witness: %w", err)
	}
	proof, err := groth16.Prove(cs, pk, witness)
	if err != nil {
		return nil, fmt.Errorf("prove: %w", err)
	}
	var buf bytes.Buffer
	if _, err := proof.WriteTo(&buf); err != nil {
		return nil, fmt.Errorf("serialize proof: %w", err)
	}
	return buf.Bytes(), nil
}

// Verify checks a Groth16 proof against the public witness (only
// ExpectedSum is public in this circuit).
func Verify(proofBytes []byte, vk groth16.VerifyingKey, expectedSum int64) error {
	proof := groth16.NewProof(ecc.BN254)
	if _, err := proof.ReadFrom(bytes.NewReader(proofBytes)); err != nil {
		return fmt.Errorf("deserialize proof: %w", err)
	}
	public := &SumCircuit{ExpectedSum: expectedSum}
	publicWitness, err := frontend.NewWitness(public, ecc.BN254.ScalarField(), frontend.PublicOnly())
	if err != nil {
		return fmt.Errorf("public witness: %w", err)
	}
	return groth16.Verify(proof, vk, publicWitness)
}
