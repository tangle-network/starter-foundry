// RISC Zero host entry point. Invokes the guest, pulls the receipt, and
// verifies it end-to-end. Run with `cargo run --release`.
//
// For local proving (default): uses your CPU. Slow — seconds-to-minutes
// depending on cycle count.
// For Bonsai cloud proving: set BONSAI_API_URL + BONSAI_API_KEY; the
// default_prover() call auto-delegates.

mod prover;

use anyhow::Result;

fn main() -> Result<()> {
    let input = prover::Input { a: 3, b: 4 };
    let (output, receipt_bytes) = prover::prove(input)?;
    println!("Proved: {} + {} = {}, product = {}", 3, 4, output.sum, output.product);
    println!("Receipt: {} bytes", receipt_bytes.len());

    // Round-trip: deserialize and re-verify. In production, this is what
    // your verifier service does on receipt submission.
    let reverified = prover::verify(&receipt_bytes)?;
    assert_eq!(output.sum, reverified.sum);
    println!("Re-verified receipt ✓");
    Ok(())
}
