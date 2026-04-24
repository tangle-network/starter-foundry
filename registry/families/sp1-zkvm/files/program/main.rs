//! SP1 program — runs INSIDE the Succinct zkVM on a RISC-V target.
//! Reads inputs via `sp1_zkvm::io::read`, commits outputs via
//! `sp1_zkvm::io::commit`. Build with `cd program && cargo prove build`.

#![no_main]
sp1_zkvm::entrypoint!(main);

pub fn main() {
    let a = sp1_zkvm::io::read::<u64>();
    let b = sp1_zkvm::io::read::<u64>();

    // Your provable logic here. For real uses, replace with a signature
    // verifier, a state-transition validator, or whatever your protocol
    // needs proven.
    let sum = a.saturating_add(b);
    let product = a.saturating_mul(b);

    // Public values — read back out of the proof in the same order.
    sp1_zkvm::io::commit(&sum);
    sp1_zkvm::io::commit(&product);
}
