//! Groth16 prover over BN254. Setup → Prove → Verify flow.
//!
//! `dev_setup` runs a per-circuit trusted setup in-process. FINE for dev
//! and tests; NOT OK for production (reveals toxic waste to the process).
//! Production loads pk/vk from ceremony artifacts or uses a universal-
//! setup system (Marlin, Plonk via ark-plonk).

use anyhow::Result;
use ark_bn254::{Bn254, Fr};
use ark_groth16::{Groth16, PreparedVerifyingKey, Proof, ProvingKey, VerifyingKey};
use ark_snark::SNARK;
use ark_std::rand::rngs::OsRng;

use crate::circuit::SumCircuit;

pub struct SetupArtifacts {
    pub pk: ProvingKey<Bn254>,
    pub vk: VerifyingKey<Bn254>,
    pub pvk: PreparedVerifyingKey<Bn254>,
}

pub fn dev_setup() -> Result<SetupArtifacts> {
    let mut rng = OsRng;
    let empty = SumCircuit::<Fr> { a: None, b: None, expected_sum: None };
    let (pk, vk) = Groth16::<Bn254>::circuit_specific_setup(empty, &mut rng)?;
    let pvk = Groth16::<Bn254>::process_vk(&vk)?;
    Ok(SetupArtifacts { pk, vk, pvk })
}

pub fn prove(pk: &ProvingKey<Bn254>, a: u64, b: u64, expected_sum: u64) -> Result<Proof<Bn254>> {
    let mut rng = OsRng;
    let circuit = SumCircuit::<Fr> {
        a: Some(Fr::from(a)),
        b: Some(Fr::from(b)),
        expected_sum: Some(Fr::from(expected_sum)),
    };
    Ok(Groth16::<Bn254>::prove(pk, circuit, &mut rng)?)
}

pub fn verify(
    pvk: &PreparedVerifyingKey<Bn254>,
    proof: &Proof<Bn254>,
    expected_sum: u64,
) -> Result<bool> {
    let public_inputs = vec![Fr::from(expected_sum)];
    Ok(Groth16::<Bn254>::verify_with_processed_vk(pvk, &public_inputs, proof)?)
}
