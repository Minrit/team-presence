//! Tiny structured-log init mirroring the server's telemetry.rs. We repeat
//! it here instead of sharing to keep the collector free of server-side deps
//! (sqlx, axum, etc.) — the field contract is what matters for ops parity.

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn init() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,team_presence_collector=debug"));

    let json = std::env::var("TP_LOG_JSON")
        .ok()
        .as_deref()
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let registry = tracing_subscriber::registry().with(filter);
    if json {
        registry.with(fmt::layer().json()).init();
    } else {
        registry.with(fmt::layer().with_target(false)).init();
    }
}
