pub fn run_job(input: &str) -> String {
    format!("{{jobName}}:attested:{}", input)
}

#[cfg(test)]
mod tests {
    use super::run_job;

    #[test]
    fn oracle_job_formats_attestation_output() {
        let output = run_job("btc-usd");
        assert!(output.contains("{{jobName}}"));
        assert!(output.contains("attested"));
        assert!(output.ends_with("btc-usd"));
    }
}
