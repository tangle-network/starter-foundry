//! Rust SDK for starter-foundry.
//!
//! Mirrors the TypeScript SDK contract:
//!
//! - `BuildoutEvent` / `BuildoutOutcome` — schema matches
//!   `src/lib/buildout-traces.ts` exactly; bump `BUILDOUT_SCHEMA_VERSION`
//!   together when extending.
//! - `emit_buildout_event` — O_APPEND, multi-writer safe trace emit.
//! - `validate_plan` — checks a plan JSON against a minimal contract
//!   (family id set, layers non-empty, schema keys present).
//!
//! The HTTP compose path is behind the `http` feature (brings in
//! `reqwest` + `tokio`). When off, the crate is pure serde + fs and
//! works in `no_std`-adjacent embedded contexts.

use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use thiserror::Error;

pub const BUILDOUT_SCHEMA_VERSION: u32 = 3;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildoutEvent {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "sourceModel")]
    pub source_model: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: Option<String>,
    #[serde(rename = "partnerGuess")]
    pub partner_guess: Option<String>,
    #[serde(rename = "replayRound")]
    pub replay_round: Option<u32>,
    #[serde(rename = "firstTs")]
    pub first_ts: Option<String>,
    #[serde(rename = "lastTs")]
    pub last_ts: Option<String>,
    #[serde(rename = "initialPrompt")]
    pub initial_prompt: Option<String>,
    #[serde(rename = "addedPackages", default)]
    pub added_packages: Vec<PackageAdd>,
    #[serde(rename = "addedDirs", default)]
    pub added_dirs: Vec<String>,
    #[serde(rename = "rewrittenFiles", default)]
    pub rewritten_files: Vec<String>,
    pub outcome: Option<BuildoutOutcome>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageAdd {
    pub pm: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildoutOutcome {
    pub source: String,
    #[serde(rename = "allPass")]
    pub all_pass: bool,
    #[serde(rename = "blendedScore")]
    pub blended_score: f64,
    #[serde(rename = "failingLayers", default)]
    pub failing_layers: Vec<String>,
    #[serde(rename = "shotsRun")]
    pub shots_run: u32,
    #[serde(rename = "shotsToConvergence")]
    pub shots_to_convergence: Option<u32>,
    #[serde(rename = "wallMs")]
    pub wall_ms: u64,
    #[serde(rename = "toolCallsTotal")]
    pub tool_calls_total: u32,
    #[serde(rename = "costUsd", skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
    #[serde(rename = "tokenCount", skip_serializing_if = "Option::is_none")]
    pub token_count: Option<u64>,
}

#[derive(Debug, Error)]
pub enum SdkError {
    #[error("io: {0}")]
    Io(#[from] io::Error),
    #[error("serialize: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("invalid input: {0}")]
    Invalid(String),
}

/// Append a buildout event to the pipeline. Atomic (`O_APPEND`); safe
/// to call from multiple concurrent processes. Creates the containing
/// directory on first call.
pub fn emit_buildout_event(event: &BuildoutEvent, traces_path: Option<&Path>) -> Result<(), SdkError> {
    if event.session_id.is_empty() {
        return Err(SdkError::Invalid("session_id is required".into()));
    }
    if event.source_model.is_empty() {
        return Err(SdkError::Invalid("source_model is required".into()));
    }
    let path: PathBuf = traces_path
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from(".evolve/traces/buildouts.jsonl"));

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let line = serde_json::to_string(event)? + "\n";
    let mut f = OpenOptions::new().create(true).append(true).open(&path)?;
    f.write_all(line.as_bytes())?;
    f.flush()?;
    Ok(())
}

/// A minimal plan spec that validate_plan recognizes. Mirrors the TS
/// ComposeSpec enough to catch malformed input at the SDK boundary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanSpec {
    #[serde(rename = "projectName")]
    pub project_name: String,
    pub family: String,
    #[serde(default)]
    pub layers: Vec<String>,
    pub partner: Option<String>,
}

pub fn validate_plan(spec: &PlanSpec) -> Result<(), SdkError> {
    if spec.project_name.is_empty() {
        return Err(SdkError::Invalid("projectName is required".into()));
    }
    if spec.family.is_empty() {
        return Err(SdkError::Invalid("family is required".into()));
    }
    if spec.layers.is_empty() {
        return Err(SdkError::Invalid("layers must not be empty".into()));
    }
    for layer in &spec.layers {
        if !layer.starts_with("framework:") && !layer.starts_with("capability:") && !layer.starts_with("industry:") {
            return Err(SdkError::Invalid(format!(
                "unknown layer prefix: {layer} (expected framework:, capability:, or industry:)"
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn emit_appends_one_line_per_call() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("buildouts.jsonl");
        let ev = BuildoutEvent {
            schema_version: BUILDOUT_SCHEMA_VERSION,
            session_id: "s1".into(),
            source_path: "/tmp/s1".into(),
            source_model: "test".into(),
            scenario_id: None,
            partner_guess: None,
            replay_round: None,
            first_ts: None,
            last_ts: None,
            initial_prompt: None,
            added_packages: vec![],
            added_dirs: vec![],
            rewritten_files: vec![],
            outcome: None,
        };
        emit_buildout_event(&ev, Some(&path)).unwrap();
        emit_buildout_event(&ev, Some(&path)).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content.lines().count(), 2);
    }

    #[test]
    fn validate_rejects_empty_layers() {
        let spec = PlanSpec {
            project_name: "x".into(),
            family: "react-vite-ts".into(),
            layers: vec![],
            partner: None,
        };
        assert!(validate_plan(&spec).is_err());
    }

    #[test]
    fn validate_rejects_unknown_layer_prefix() {
        let spec = PlanSpec {
            project_name: "x".into(),
            family: "react-vite-ts".into(),
            layers: vec!["invalid:foo".into()],
            partner: None,
        };
        assert!(validate_plan(&spec).is_err());
    }

    #[test]
    fn validate_accepts_well_formed() {
        let spec = PlanSpec {
            project_name: "x".into(),
            family: "react-vite-ts".into(),
            layers: vec!["framework:react-vite-ts".into(), "capability:tailwind".into()],
            partner: None,
        };
        assert!(validate_plan(&spec).is_ok());
    }
}
