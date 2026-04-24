// Guest program — runs INSIDE the RISC Zero zkVM on a RISC-V target.
// No std::net, no std::fs, no std::time::SystemTime, limited float.
// Pure compute + serde + crypto + hashing.

#![no_main]

use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};

risc0_zkvm::guest::entry!(main);

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

pub fn main() {
    let input: Input = env::read();

    // Your provable logic goes here. Replace this with a hash check, a
    // signature verification, a state-transition validator, or whatever
    // your protocol needs proven.
    let output = Output {
        sum: input.a.saturating_add(input.b),
        product: input.a.saturating_mul(input.b),
    };

    // Committed values land in the receipt's journal — publicly verifiable
    // alongside the proof.
    env::commit(&output);
}
