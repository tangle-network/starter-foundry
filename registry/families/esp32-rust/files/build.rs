// Build-time hook for esp-idf-sys. Resolves the ESP-IDF checkout,
// runs its cmake, and wires the output into cargo's link search path.
// Without embuild::espidf::sysenv::output() the final ELF will fail to
// link because the ESP-IDF static libs (freertos, esp_wifi, lwip ...)
// are nowhere on the link line.

fn main() {
    embuild::espidf::sysenv::output();
}
