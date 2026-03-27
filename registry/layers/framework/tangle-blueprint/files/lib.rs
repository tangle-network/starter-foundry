pub fn run_job(input: &str) -> String {
    format!("{}:{}", "{{jobName}}", input)
}

#[cfg(test)]
mod tests {
    use super::run_job;

    #[test]
    fn blueprint_job_formats_output() {
        let output = run_job("demo");
        assert!(output.contains("{{jobName}}"));
        assert!(output.ends_with("demo"));
    }
}
