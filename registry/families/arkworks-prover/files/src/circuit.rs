//! Arkworks circuit — implements `ConstraintSynthesizer`. Every relation
//! the prover must satisfy is added via calls on the constraint-system
//! handle (`cs`). Bare Rust expressions DO NOT constrain — if the only
//! line mentioning your variable is `let x = &a + &b;`, no constraint
//! exists. You must follow with `x.enforce_equal(...)` or similar.

use ark_ff::PrimeField;
use ark_r1cs_std::{alloc::AllocVar, eq::EqGadget, fields::fp::FpVar};
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, SynthesisError};

/// Proves knowledge of (a, b) such that a + b == expected_sum.
/// - `a`, `b`: private witnesses (prover knows, verifier does not)
/// - `expected_sum`: public input (verifier supplies at verify time)
pub struct SumCircuit<F: PrimeField> {
    pub a: Option<F>,
    pub b: Option<F>,
    pub expected_sum: Option<F>,
}

impl<F: PrimeField> ConstraintSynthesizer<F> for SumCircuit<F> {
    fn generate_constraints(self, cs: ConstraintSystemRef<F>) -> Result<(), SynthesisError> {
        let a_var = FpVar::new_witness(cs.clone(), || {
            self.a.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let b_var = FpVar::new_witness(cs.clone(), || {
            self.b.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let expected_var = FpVar::new_input(cs, || {
            self.expected_sum.ok_or(SynthesisError::AssignmentMissing)
        })?;

        // enforce_equal is what binds the prover. Without this call the
        // proof would be trivial and useless.
        let sum_var = &a_var + &b_var;
        sum_var.enforce_equal(&expected_var)?;

        Ok(())
    }
}
