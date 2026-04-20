use wasm_bindgen::prelude::*;

// Every function annotated with `#[wasm_bindgen]` becomes callable from JS
// after `pnpm run build:wasm`. Types are auto-translated — &str → string,
// Vec<u8> → Uint8Array, primitives passthrough.

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello from Rust+WASM, {name}!")
}

#[wasm_bindgen]
pub fn fibonacci(n: u32) -> u64 {
    if n < 2 {
        return n as u64;
    }
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 2..=n {
        let next = a + b;
        a = b;
        b = next;
    }
    b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greet_works() {
        assert_eq!(greet("world"), "Hello from Rust+WASM, world!");
    }

    #[test]
    fn fibonacci_matches_known_values() {
        assert_eq!(fibonacci(0), 0);
        assert_eq!(fibonacci(1), 1);
        assert_eq!(fibonacci(10), 55);
        assert_eq!(fibonacci(50), 12586269025);
    }
}
