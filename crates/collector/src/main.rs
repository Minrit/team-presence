use clap::Parser;
use team_presence_collector::{
    cli::{Cli, Command, InstallHooksArgs, LoginArgs, StartArgs},
    client::ApiClient,
    consent, credentials, diagnostics, hooks, mute, start, telemetry,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    telemetry::init();
    let cli = Cli::parse();

    match cli.command {
        Command::Login(args) => cmd_login(args).await?,
        Command::Start(args) => cmd_start(args).await?,
        Command::Status => cmd_status()?,
        Command::Doctor => cmd_doctor()?,
        Command::Mute => {
            mute::mute()?;
            println!("muted — content frames suppressed until `team-presence unmute`.");
        }
        Command::Unmute => {
            mute::unmute()?;
            println!("unmuted — content frames resumed.");
        }
        Command::InstallHooks(args) => cmd_install_hooks(args)?,
        Command::UninstallHooks => cmd_uninstall_hooks()?,
        Command::Logout => cmd_logout()?,
    }
    Ok(())
}

async fn cmd_login(args: LoginArgs) -> anyhow::Result<()> {
    if !args.yes {
        let accepted = consent::prompt_from_tty(&args.server)?;
        if !accepted {
            anyhow::bail!("consent declined — no credentials saved");
        }
    }

    let password = read_password("password: ")?;
    let api = ApiClient::new(&args.server)?;

    let login = api.login(&args.email, &password).await?;
    tracing::info!(
        component = "collector.login",
        phase = "login_ok",
        user_id = %login.user.id,
        "auth accepted"
    );

    let collector_name = args
        .name
        .or_else(hostname)
        .unwrap_or_else(|| "unnamed-laptop".into());
    let mint = api
        .mint_collector_token(&login.access_token, &collector_name)
        .await?;

    let creds = credentials::Credentials::new(
        args.server,
        login.user.email.clone(),
        mint.id,
        mint.name.clone(),
        mint.token,
    );

    credentials::save(&creds, false)?;
    println!(
        "logged in as {} ({}); collector {:?} registered (id {}).",
        login.user.display_name, login.user.email, mint.name, mint.id
    );
    println!("credentials stored via OS keyring with 0600 file fallback.");
    Ok(())
}

async fn cmd_start(args: StartArgs) -> anyhow::Result<()> {
    let creds = credentials::load()?.ok_or_else(|| {
        anyhow::anyhow!(
            "no credentials — run `team-presence login --server <url> --email <you>` first"
        )
    })?;
    start::run(creds, args.agent.into_wire()).await
}

fn cmd_status() -> anyhow::Result<()> {
    let report = diagnostics::collect_status()?;
    if report.logged_in {
        println!("status:    logged in");
        println!("server:    {}", report.server.as_deref().unwrap_or("?"));
        println!("user:      {}", report.user_email.as_deref().unwrap_or("?"));
        println!(
            "collector: {} (id {})",
            report.collector_name.as_deref().unwrap_or("?"),
            report.collector_id.as_deref().unwrap_or("?"),
        );
    } else {
        println!("status:    not logged in — run `team-presence login`");
    }
    println!("muted:     {}", report.muted);
    println!("config:    {}", report.config_dir.display());
    println!("fallback:  {}", report.fallback_path.display());
    println!("socket:    {}", report.socket_path.display());
    println!("agent:     opencode");
    println!("opencode_db: {}", report.opencode_db.path.display());
    println!("opencode_db_state: {}", report.opencode_db.state.as_str());
    match report.opencode_db.last_event_at {
        Some(ts) => println!("opencode_last_event_at: {ts}"),
        None => println!("opencode_last_event_at: -"),
    }
    if let Some(hint) = report.opencode_db.state.hint(&report.opencode_db.path) {
        println!("opencode_hint: {hint}");
    }
    Ok(())
}

fn cmd_doctor() -> anyhow::Result<()> {
    let report = diagnostics::collect_status()?;
    println!("doctor: collector local diagnostics");
    println!("status: {}", if report.logged_in { "logged_in" } else { "logged_out" });
    if report.logged_in {
        println!("server: {}", report.server.as_deref().unwrap_or("?"));
        println!("collector_id: {}", report.collector_id.as_deref().unwrap_or("?"));
    } else {
        println!("hint: run `team-presence login --server <url> --email <you>` first");
    }
    println!("agent_mode: opencode");
    println!("muted: {}", report.muted);
    println!("socket: {}", report.socket_path.display());
    println!("opencode_db: {}", report.opencode_db.path.display());
    println!("opencode_db_state: {}", report.opencode_db.state.as_str());
    if let Some(ts) = report.opencode_db.last_event_at {
        println!("opencode_last_event_at: {ts}");
    } else {
        println!("opencode_last_event_at: -");
    }
    if let Some(hint) = report.opencode_db.state.hint(&report.opencode_db.path) {
        println!("fix: {hint}");
    }
    if !report.logged_in || !matches!(report.opencode_db.state, diagnostics::OpenCodeDbState::Readable) {
        std::process::exit(2);
    }
    println!("doctor: ok");
    Ok(())
}

fn cmd_install_hooks(args: InstallHooksArgs) -> anyhow::Result<()> {
    // Soft detect: if no claude binary, exit 2 with a helpful message.
    if which("claude").is_none() {
        eprintln!(
            "error: `claude` binary not found on PATH. Install Claude Code first, \
             or re-run with --dir to force a custom hooks directory."
        );
        std::process::exit(2);
    }

    let report = hooks::install(args.dir, args.force)?;
    println!("installed into {}:", report.dir.display());
    for p in &report.installed {
        println!("  + {}", p.display());
    }
    for p in &report.skipped {
        println!("  - skipped (exists): {}", p.display());
    }
    if report.installed.is_empty() && !report.skipped.is_empty() {
        println!("(pass --force to overwrite existing scripts.)");
    }
    if let Some(path) = &report.settings_path {
        if report.settings_updated {
            println!("  + wired SessionStart into {}", path.display());
        } else {
            println!("  = SessionStart already wired in {}", path.display());
        }
    }
    Ok(())
}

fn cmd_uninstall_hooks() -> anyhow::Result<()> {
    let report = hooks::uninstall(None)?;
    if report.removed_scripts.is_empty() {
        println!("no team-presence hooks found.");
    } else {
        for p in &report.removed_scripts {
            println!("removed {}", p.display());
        }
    }
    if let (Some(path), true) = (report.settings_path.as_ref(), report.settings_updated) {
        println!("cleaned team-presence entries from {}", path.display());
    }
    Ok(())
}

fn cmd_logout() -> anyhow::Result<()> {
    credentials::clear()?;
    println!(
        "local credentials cleared. Revoke server-side with \
         `DELETE /api/v1/collectors/:id` (or via the server UI)."
    );
    Ok(())
}

fn read_password(prompt: &str) -> anyhow::Result<String> {
    use std::io::{BufRead, Write};
    eprint!("{prompt}");
    std::io::stderr().flush().ok();
    let stdin = std::io::stdin();
    let mut line = String::new();
    stdin.lock().read_line(&mut line)?;
    Ok(line.trim_end_matches(['\r', '\n']).to_string())
}

fn hostname() -> Option<String> {
    // Good-enough fallback — avoids pulling in the `hostname` crate for 1 call site.
    std::env::var("HOSTNAME")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            std::process::Command::new("hostname")
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
}

fn which(binary: &str) -> Option<std::path::PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(binary);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}
