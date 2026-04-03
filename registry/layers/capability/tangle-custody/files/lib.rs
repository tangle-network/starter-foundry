use blueprint_sdk::Router;
use blueprint_sdk::tangle::extract::{Caller, TangleArg, TangleResult};
use serde::{Deserialize, Serialize};

pub const CUSTODY_JOB_ID: u8 = 0;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct CustodyRequest {
    pub action: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct CustodyResponse {
    pub action: String,
    pub approval: String,
    pub operator: String,
}

/// Custody job — processes threshold signing requests.
pub async fn custody_job(
    Caller(caller): Caller,
    TangleArg(request): TangleArg<CustodyRequest>,
) -> TangleResult<CustodyResponse> {
    let approval = format!("{{jobName}}:approved:{}", request.action);

    TangleResult(CustodyResponse {
        action: request.action,
        approval,
        operator: caller.to_string(),
    })
}

#[must_use]
pub fn router() -> Router {
    Router::new().route(CUSTODY_JOB_ID, custody_job)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn custody_job_formats_threshold_output() {
        let caller = [0u8; 32].into();
        let request = CustodyRequest {
            action: "transfer".to_string(),
        };

        let result = custody_job(Caller(caller), TangleArg(request)).await;
        assert!(result.0.approval.contains("approved"));
        assert!(result.0.approval.ends_with("transfer"));
    }
}
