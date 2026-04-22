use blueprint_sdk::Job;
use blueprint_sdk::Router;
use blueprint_sdk::alloy::primitives::Address;
use blueprint_sdk::alloy::sol;
use blueprint_sdk::tangle::TangleLayer;
use blueprint_sdk::tangle::extract::{Caller, TangleArg, TangleResult};

/// Job ID for the {{jobName}} job.
pub const JOB_ID: u8 = 0;

// Solidity ABI-compatible input + output types. Tangle jobs receive
// ABI-encoded `bytes calldata` on-chain and emit `bytes` back — every
// `TangleArg<T>` / `TangleResult<T>` payload must therefore be a
// `SolValue`. The `sol!` macro generates both the Rust struct and the
// SolValue/SolStruct impls in one declaration.
sol! {
    struct JobRequest {
        string input;
    }

    struct JobResponse {
        string result;
        string operator;
    }
}

/// Handles the {{jobName}} job.
pub async fn handle_job(
    Caller(caller): Caller,
    TangleArg(request): TangleArg<JobRequest>,
) -> TangleResult<JobResponse> {
    let result = format!("{}:{}", "{{jobName}}", request.input);

    TangleResult(JobResponse {
        result,
        // `caller` is `[u8; 20]` (the raw EVM-address bytes). Wrap in
        // `Address` to render as the canonical 0x-prefixed EIP-55
        // checksummed hex string.
        operator: Address::from(caller).to_checksum(None),
    })
}

/// Router that maps job IDs to handlers.
///
/// `TangleLayer` is required when the handler uses Tangle extractors
/// (`Caller`, `TangleArg<T>`, etc.) — it translates a raw `JobCall`'s
/// encoded payload + metadata into the concrete extractor types. Plain
/// `async fn() -> impl IntoJobResult` handlers don't need it.
#[must_use]
pub fn router() -> Router {
    Router::new().route(JOB_ID, handle_job.layer(TangleLayer))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn job_produces_output() {
        let caller = Caller([0u8; 20]);
        let request = JobRequest {
            input: "demo".to_string(),
        };

        let result = handle_job(caller, TangleArg(request)).await;
        assert!(result.0.result.contains("{{jobName}}"));
        assert!(result.0.result.ends_with("demo"));
    }
}
