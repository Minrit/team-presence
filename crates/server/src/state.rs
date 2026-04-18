use sqlx::{postgres::PgPoolOptions, PgPool};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: redis::Client,
    pub jwt: Arc<JwtConfig>,
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

        Ok(Self {
            db,
            redis,
            jwt: Arc::new(JwtConfig {
                secret,
                access_ttl_secs: 15 * 60,         // 15 min
                refresh_ttl_secs: 30 * 24 * 3600, // 30 days
            }),
        })
    }
}
