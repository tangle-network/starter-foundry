// Entry point — all logic lives in lib.rs so the binary stays small and
// the menu-bar setup can be unit-tested without spinning up a window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    {{crateName}}_lib::run();
}
