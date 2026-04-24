//! SP1 driver. Builds the prover client, feeds inputs into the program,
//! proves, verifies, returns public values + the proof.

use anyhow::{Context, Result};
use sp1_sdk::{include_elf, ProverClient, SP1ProofWithPublicValues, SP1Stdin};

// Embeds the compiled program ELF at build time (requires sp1-build in
// script's [build-dependencies]). The string name matches the program
// crate's [package] name in program/Cargo.toml.
const PROGRAM_ELF: &[u8] = include_elf!("program");

pub fn prove_sum_and_product(
    a: u64,
    b: u64,
) -> Result<(u64, u64, SP1ProofWithPublicValues)> {
    let mut stdin = SP1Stdin::new();
    stdin.write(&a);
    stdin.write(&b);

    // SP1_PROVER env picks the mode:
    //   mock    → no real proof, returns instantly (tight dev loop)
    //   cpu     → local CPU prove (seconds-to-minutes)
    //   network → Succinct prover network (needs SP1_PRIVATE_KEY)
    let client = ProverClient::from_env();
    let (pk, vk) = client.setup(PROGRAM_ELF);

    let proof = client.prove(&pk, &stdin).run().context("prove")?;
    client.verify(&proof, &vk).context("verify")?;

    // Decode public values in the same order the program committed.
    let mut pv = proof.public_values.clone();
    let sum = pv.read::<u64>();
    let product = pv.read::<u64>();

    Ok((sum, product, proof))
}
