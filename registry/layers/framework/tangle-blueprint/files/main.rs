use std::env;

fn main() {
    if env::args().any(|arg| arg == "--once") {
        println!("blueprint run ok");
        return;
    }

    println!("{{blueprintName}} ready");
}
