use team_presence_server::{build_router, state::AppState, telemetry};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    telemetry::init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://tp:tp@localhost:5433/team_presence".into());

    let state = AppState::new(&database_url).await?;
    sqlx::migrate!("./migrations").run(&state.db).await?;
    tracing::info!(component = "server", phase = "migrations_applied", "database migrations up to date");

    let app = build_router(state);

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
