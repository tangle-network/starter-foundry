// Prover wrapper — invokes the guest ELF via default_prover(), extracts the
// committed output from the receipt journal, returns both the output and a
// serialized receipt ready for transport or on-chain verification.

use anyhow::{Context, Result};
use methods::{GUEST_ELF, GUEST_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use serde::{Deserialize, Serialize};

// Must match the guest's Input/Output shape — keep in sync.
#[derive(Debug, Deserialize, Serialize)]
pub struct Input {
    pub a: u64,
    pub b: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Output {
    pub sum: u64,
    pub product: u64,
}

pub fn prove(input: Input) -> Result<(Output, Vec<u8>)> {
    let env = ExecutorEnv::builder()
        .write(&input)
        .context("write input")?
        .build()
        .context("build env")?;

    // default_prover() picks local CPU prover or Bonsai based on env vars:
    //   BONSAI_API_URL + BONSAI_API_KEY → remote (fast)
    //   (unset) → local (slow, dev-only)
    let prover = default_prover();
    let prove_info = prover.prove(env, GUEST_ELF).context("prove")?;
    let receipt = prove_info.receipt;

    let output: Output = receipt.journal.decode().context("decode journal")?;
    let receipt_bytes = bincode::serialize(&receipt).context("serialize receipt")?;

    Ok((output, receipt_bytes))
}

pub fn verify(receipt_bytes: &[u8]) -> Result<Output> {
    let receipt: risc0_zkvm::Receipt = bincode::deserialize(receipt_bytes).context("deserialize")?;
    receipt.verify(GUEST_ID).context("verify receipt")?;
    let output: Output = receipt.journal.decode().context("decode journal")?;
    Ok(output)
}
