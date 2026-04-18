use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "team-presence",
    version,
    about = "Laptop-side collector for the team-presence platform.",
    long_about = "Streams your claude-code sessions to a team-presence server \
                  so teammates can see what you're working on. \
                  Content is 24h-TTL in Redis; metadata is retained in Postgres."
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Log in to a team-presence server and mint a collector token.
    Login(LoginArgs),

    /// Start the collector daemon: listen for claude-code hook events,
    /// tail transcripts, stream frames to the server over WebSocket.
    Start,

    /// Print current configuration + credential state.
    Status,

    /// Pause content streaming (heartbeat + session metadata still flow).
    Mute,

    /// Resume content streaming.
    Unmute,

    /// Install claude-code hook scripts into ~/.claude/hooks/.
    InstallHooks(InstallHooksArgs),

    /// Remove claude-code hook scripts installed by `install-hooks`.
    UninstallHooks,

    /// Revoke local credentials — server-side revocation is a separate
    /// `DELETE /api/v1/collectors/:id` call.
    Logout,
}

#[derive(Debug, clap::Args)]
pub struct LoginArgs {
    /// Server URL, e.g. https://team-presence.example.com
    #[arg(long)]
    pub server: String,

    /// Email address of your team-presence account.
    #[arg(long)]
    pub email: String,

    /// Collector token name (shows in the server UI). Defaults to hostname.
    #[arg(long)]
    pub name: Option<String>,

    /// Skip the first-run consent prompt (used by scripted installs after
    /// consent was captured out-of-band).
    #[arg(long)]
    pub yes: bool,
}

#[derive(Debug, clap::Args)]
pub struct InstallHooksArgs {
    /// Override claude-code hooks directory. Defaults to ~/.claude/hooks.
    #[arg(long)]
    pub dir: Option<std::path::PathBuf>,

    /// Overwrite existing hook scripts if present.
    #[arg(long)]
    pub force: bool,
}
