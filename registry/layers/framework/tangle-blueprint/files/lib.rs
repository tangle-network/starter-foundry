use blueprint_sdk::Router;
use blueprint_sdk::tangle::extract::{Caller, TangleArg, TangleResult};
use serde::{Deserialize, Serialize};

/// Job ID for the {{jobName}} job.
pub const JOB_ID: u8 = 0;

/// Input payload sent from the Tangle contract.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct JobRequest {
    pub input: String,
}

/// Output payload returned back to the caller.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct JobResponse {
    pub result: String,
    pub operator: String,
}

/// Handles the {{jobName}} job.
pub async fn handle_job(
    Caller(caller): Caller,
    TangleArg(request): TangleArg<JobRequest>,
) -> TangleResult<JobResponse> {
    let result = format!("{}:{}", "{{jobName}}", request.input);

    TangleResult(JobResponse {
        result,
        operator: caller.to_string(),
    })
}

/// Router that maps job IDs to handlers.
#[must_use]
pub fn router() -> Router {
    Router::new().route(JOB_ID, handle_job)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn job_produces_output() {
        let caller = [0u8; 32].into();
        let request = JobRequest {
            input: "demo".to_string(),
        };

        let result = handle_job(Caller(caller), TangleArg(request)).await;
        assert!(result.0.result.contains("{{jobName}}"));
        assert!(result.0.result.ends_with("demo"));
    }
}
