use clap::Parser;
use team_presence_collector::{
    cli::{Cli, Command, InstallHooksArgs, LoginArgs},
    client::ApiClient,
    config, consent, credentials, hooks, mute, start, telemetry,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    telemetry::init();
    let cli = Cli::parse();

    match cli.command {
        Command::Login(args) => cmd_login(args).await?,
        Command::Start => cmd_start().await?,
        Command::Status => cmd_status()?,
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

async fn cmd_start() -> anyhow::Result<()> {
    let creds = credentials::load()?.ok_or_else(|| {
        anyhow::anyhow!(
            "no credentials — run `team-presence login --server <url> --email <you>` first"
        )
    })?;
    start::run(creds).await
}

fn cmd_status() -> anyhow::Result<()> {
    let muted = mute::is_muted();
    let config_dir = config::config_dir()?;
    match credentials::load()? {
        Some(c) => {
            println!("status:    logged in");
            println!("server:    {}", c.server);
            println!("user:      {}", c.user_email);
            println!("collector: {} (id {})", c.collector_name, c.collector_id);
        }
        None => {
            println!("status:    not logged in — run `team-presence login`");
        }
    }
    println!("muted:     {muted}");
    println!("config:    {}", config_dir.display());
    println!("fallback:  {}", credentials::fallback_path()?.display());
    println!("socket:    {}", config::hook_socket_path().display());
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
    Ok(())
}

fn cmd_uninstall_hooks() -> anyhow::Result<()> {
    let removed = hooks::uninstall(None)?;
    if removed.is_empty() {
        println!("no team-presence hooks found.");
    } else {
        for p in &removed {
            println!("removed {}", p.display());
        }
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
