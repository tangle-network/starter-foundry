use blueprint_sdk::Router;
use blueprint_sdk::tangle::extract::{Caller, TangleArg, TangleResult};
use serde::{Deserialize, Serialize};

pub const ORACLE_JOB_ID: u8 = 0;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct OracleRequest {
    pub pair: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct OracleResponse {
    pub pair: String,
    pub attestation: String,
    pub operator: String,
}

/// Oracle job — fetches price data and returns an attestation.
pub async fn oracle_job(
    Caller(caller): Caller,
    TangleArg(request): TangleArg<OracleRequest>,
) -> TangleResult<OracleResponse> {
    let attestation = format!("{{jobName}}:attested:{}", request.pair);

    TangleResult(OracleResponse {
        pair: request.pair,
        attestation,
        operator: caller.to_string(),
    })
}

#[must_use]
pub fn router() -> Router {
    Router::new().route(ORACLE_JOB_ID, oracle_job)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn oracle_job_formats_attestation_output() {
        let caller = [0u8; 32].into();
        let request = OracleRequest {
            pair: "btc-usd".to_string(),
        };

        let result = oracle_job(Caller(caller), TangleArg(request)).await;
        assert!(result.0.attestation.contains("attested"));
        assert!(result.0.attestation.ends_with("btc-usd"));
    }
}
