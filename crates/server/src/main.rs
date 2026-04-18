mod telemetry;

use axum::{routing::get, Router};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    telemetry::init();

    let app = Router::new().route("/health", get(health));

    let addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into());
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!(
        addr = %addr,
        component = "server",
        phase = "startup",
        "team-presence server listening"
    );

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> &'static str {
    "ok"
}
