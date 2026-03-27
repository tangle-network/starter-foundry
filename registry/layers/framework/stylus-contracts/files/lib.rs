pub fn contract_name() -> &'static str {
    "{{contractName}}"
}

#[cfg(test)]
mod tests {
    use super::contract_name;

    #[test]
    fn stylus_contract_has_name() {
        assert!(contract_name().contains("Stylus"));
    }
}
