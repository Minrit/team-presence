use rmcp::{transport::stdio, ServiceExt};
use team_presence_tp_mcp::{api::ApiClient, server::TpMcp};
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // stderr so Claude Code's MCP plumbing (which reads stdout) isn't confused.
    let filter = EnvFilter::try_from_env("TP_MCP_LOG").unwrap_or_else(|_| EnvFilter::new("info"));
    fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .init();

    tracing::info!(version = env!("CARGO_PKG_VERSION"), "tp-mcp starting");

    // Credentials are optional at boot — we still want the process to answer
    // `initialize` / `tools/list` so the agent can see which tools exist. Any
    // write tool that needs auth will return NotLoggedIn with a clear hint.
    let api = match ApiClient::from_credentials() {
        Ok(c) => {
            tracing::info!(
                user_email = c.user_email(),
                "credentials loaded — tools are armed"
            );
            Some(c)
        }
        Err(e) => {
            tracing::warn!(
                error = %e,
                "no credentials — run `team-presence login` to arm write tools"
            );
            None
        }
    };

    let service = TpMcp::new(api).serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}
