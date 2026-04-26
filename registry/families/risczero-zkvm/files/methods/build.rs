// Build script — embeds the compiled guest ELF into the methods crate as
// `GUEST_ELF` + `GUEST_ID` constants. Host imports both.
//
// In environments without the RISC Zero rust toolchain (`rzup install rust`),
// risc0-build would panic trying to invoke `cargo build --target riscv32im-...`.
// To keep `cargo check` green for downstream tooling and CI audits, we detect
// the toolchain first and fall back to RISC0_SKIP_BUILD=1, which makes
// risc0-build emit empty `GUEST_ELF`/zero `GUEST_ID` constants. Real proving
// requires the toolchain — install via
// `curl -L https://risczero.com/install | bash && rzup install rust`.

use std::env;
use std::process::Command;

fn main() {
    let toolchain_present = Command::new("cargo")
        .args(["+risc0", "--version"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let skip = !env::var("RISC0_SKIP_BUILD").unwrap_or_default().is_empty();

    if !toolchain_present && !skip {
        // SAFETY: we set the env var before risc0_build reads it. Single-threaded
        // build script, no other readers.
        unsafe {
            env::set_var("RISC0_SKIP_BUILD", "1");
        }
        println!(
            "cargo:warning=RISC Zero rust toolchain not found; embedding empty GUEST_ELF. \
             Install via `rzup install rust` (https://risczero.com/install) for real proofs."
        );
    }

    risc0_build::embed_methods();
}
