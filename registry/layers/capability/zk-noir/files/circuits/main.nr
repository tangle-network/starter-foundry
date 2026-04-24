// Noir circuit. Compiles with `nargo compile` into target/circuit.json (ACIR bytecode).
// Syntax is Rust-flavored but constrained — all values are field elements
// under the curve's prime (BN254 by default). Loops must have bounded
// iteration counts known at compile time.

/// Proves that the prover knows two numbers (`a`, `b`) whose sum matches a
/// publicly-committed expected value. Private inputs are unannotated; public
/// inputs carry the `pub` marker.
fn main(a: Field, b: Field, expected_sum: pub Field) {
    let sum = a + b;
    assert(sum == expected_sum);
}

#[test]
fn test_main_happy_path() {
    main(3, 4, 7);
}

#[test(should_fail)]
fn test_main_wrong_sum_fails() {
    main(3, 4, 8);
}
