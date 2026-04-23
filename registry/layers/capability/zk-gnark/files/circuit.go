// Gnark circuit. Witness fields (private + public) live on a struct that
// implements frontend.Circuit.Define. The constraint system is built at
// Define() time by calling api.* methods.

package main

import (
	"github.com/consensys/gnark/frontend"
)

// SumCircuit proves the prover knows (A, B) such that A + B == ExpectedSum.
// - A, B: private inputs (default visibility)
// - ExpectedSum: public input (must match in verifier's public witness)
type SumCircuit struct {
	A           frontend.Variable `gnark:",secret"`
	B           frontend.Variable `gnark:",secret"`
	ExpectedSum frontend.Variable `gnark:",public"`
}

// Define is called by gnark during circuit compilation. Every call to
// api.AssertIsEqual (or other assertion/constraint APIs) adds a constraint
// the prover must satisfy. Bare Go comparisons (==, !=) DO NOT constrain —
// use api.* exclusively.
func (c *SumCircuit) Define(api frontend.API) error {
	sum := api.Add(c.A, c.B)
	api.AssertIsEqual(sum, c.ExpectedSum)
	return nil
}
