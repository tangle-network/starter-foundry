//! Arkworks prover — dev example. Runs setup + prove + verify end-to-end
//! with a trivial sum-circuit. Replace the circuit module with your
//! application-specific constraints.

mod circuit;
mod prover;

use anyhow::Result;

fn main() -> Result<()> {
    // Dev setup. DO NOT use this in production — it generates fresh
    // trusted-setup parameters in-process, which exposes the toxic
    // waste to whatever process runs it. Real deployments load pk/vk
    // from a ceremony (Powers of Tau) or use a universal-setup system.
    let artifacts = prover::dev_setup()?;
    println!("Setup complete — pk/vk generated (dev only)");

    let proof = prover::prove(&artifacts.pk, 3, 4, 7)?;
    println!("Proved knowledge of (3, 4) such that sum == 7");

    let ok = prover::verify(&artifacts.pvk, &proof, 7)?;
    assert!(ok, "honest proof should verify");
    println!("Verified ✓");

    // Tamper check — pass a wrong public input.
    let tampered = prover::verify(&artifacts.pvk, &proof, 8)?;
    assert!(!tampered, "wrong public input must be rejected");
    println!("Rejected tampered public input ✓");

    Ok(())
}
