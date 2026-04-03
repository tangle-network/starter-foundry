use {{crateName}}_lib::router;
use blueprint_sdk::contexts::tangle::TangleClientContext;
use blueprint_sdk::crypto::tangle_pair_signer::TanglePairSigner;
use blueprint_sdk::keystore::backends::Backend;
use blueprint_sdk::keystore::crypto::sp_core::SpSr25519;
use blueprint_sdk::runner::BlueprintRunner;
use blueprint_sdk::runner::config::BlueprintEnvironment;
use blueprint_sdk::runner::tangle::config::TangleConfig;
use blueprint_sdk::tangle::consumer::TangleConsumer;
use blueprint_sdk::tangle::producer::TangleProducer;
use blueprint_sdk::{error, info};

#[tokio::main]
async fn main() -> Result<(), blueprint_sdk::Error> {
    setup_log();

    let env = BlueprintEnvironment::load()?;

    let tangle_client = env
        .tangle_client()
        .await
        .map_err(|e| blueprint_sdk::Error::Other(e.to_string()))?;

    let sr25519_signer = env
        .keystore()
        .first_local::<SpSr25519>()
        .map_err(|e| blueprint_sdk::Error::Other(e.to_string()))?;
    let sr25519_pair = env
        .keystore()
        .get_secret::<SpSr25519>(&sr25519_signer)
        .map_err(|e| blueprint_sdk::Error::Other(e.to_string()))?;
    let tangle_signer = TanglePairSigner::new(sr25519_pair.0);

    let service_id = env
        .protocol_settings
        .tangle()
        .map_err(|e| blueprint_sdk::Error::Other(e.to_string()))?
        .service_id
        .ok_or_else(|| blueprint_sdk::Error::Other("SERVICE_ID missing".into()))?;

    info!("Starting {{blueprintName}} for service {service_id}");

    let tangle_producer = TangleProducer::finalized_blocks(tangle_client.rpc_client.clone())
        .await
        .map_err(|e| blueprint_sdk::Error::Other(e.to_string()))?;
    let tangle_consumer = TangleConsumer::new(tangle_client.rpc_client.clone(), tangle_signer);
    let tangle_config = TangleConfig::default();

    let result = BlueprintRunner::builder(tangle_config, env)
        .router(router())
        .producer(tangle_producer)
        .consumer(tangle_consumer)
        .with_shutdown_handler(async {
            info!("Shutting down {{blueprintName}}");
        })
        .run()
        .await;

    if let Err(e) = result {
        error!("Runner failed: {e:?}");
    }

    Ok(())
}

fn setup_log() {
    use tracing_subscriber::{EnvFilter, fmt};
    let filter = EnvFilter::from_default_env();
    fmt().with_env_filter(filter).init();
}
