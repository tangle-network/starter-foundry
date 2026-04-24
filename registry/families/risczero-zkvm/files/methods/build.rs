// Build script — embeds the compiled guest ELF into the methods crate as
// `GUEST_ELF` + `GUEST_ID` constants. Host imports both.

fn main() {
    risc0_build::embed_methods();
}
