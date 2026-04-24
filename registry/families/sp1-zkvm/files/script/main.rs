//! SP1 script entry point. Invokes the prover, verifies the proof, decodes
//! public values.

mod prover;

use anyhow::Result;

fn main() -> Result<()> {
    let (sum, product, proof) = prover::prove_sum_and_product(3, 4)?;
    println!("Proved: 3 + 4 = {sum}, product = {product}");
    println!("Proof size: {} bytes", proof.bytes().len());
    Ok(())
}
