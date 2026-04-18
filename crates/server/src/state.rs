use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{path::PathBuf, sync::Arc};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: redis::Client,
    pub jwt: Arc<JwtConfig>,
    /// Directory that holds the tp-mcp release artifacts + `manifest.json`
    /// served at `/download/*`. Defaults to `./downloads` relative to the
    /// server's CWD; override via `TP_DOWNLOADS_DIR`. See plan 010.
    pub downloads_dir: Arc<PathBuf>,
}

pub struct JwtConfig {
    pub secret: String,
    pub access_ttl_secs: u64,
    pub refresh_ttl_secs: u64,
}

impl AppState {
    pub async fn new(database_url: &str, redis_url: &str) -> anyhow::Result<Self> {
        let db = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;

        let redis = redis::Client::open(redis_url)?;

        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
            tracing::warn!(
                component = "server",
                phase = "startup",
                "JWT_SECRET not set — using dev-only default. MUST set before production deploy."
            );
            "dev-only-not-for-prod-change-me".into()
        });

        let downloads_dir = std::env::var("TP_DOWNLOADS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("./downloads"));

        Ok(Self {
            db,
            redis,
            jwt: Arc::new(JwtConfig {
                secret,
                access_ttl_secs: 15 * 60,         // 15 min
                refresh_ttl_secs: 30 * 24 * 3600, // 30 days
            }),
            downloads_dir: Arc::new(downloads_dir),
        })
    }
}
