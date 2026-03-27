pub fn run_job(input: &str) -> String {
    format!("{{jobName}}:approved:{}", input)
}

#[cfg(test)]
mod tests {
    use super::run_job;

    #[test]
    fn custody_job_formats_threshold_output() {
        let output = run_job("transfer");
        assert!(output.contains("{{jobName}}"));
        assert!(output.contains("approved"));
        assert!(output.ends_with("transfer"));
    }
}
