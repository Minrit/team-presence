//! `import-bmad` — one-shot CLI to import a bmad `docs/stories/` tree into
//! the platform's `stories` table. Dry-run by default.
//!
//! Usage:
//!
//!   cargo run --bin import-bmad -- --dir <path> [--apply] [--dedup-by title] [--actor <email>]
//!
//! Exit codes:
//!   0   success (dry-run or apply)
//!   1   one or more files failed to parse (dry-run)
//!   2   --dir missing, usage error, or DB/network failure during apply
//!
//! Flow:
//!   * Scan <dir>/*.md (non-recursive — bmad's layout is flat).
//!   * Parse each: frontmatter → H1 → filename fallback; status-synonym map.
//!   * Print a diff-style preview.
//!   * If --apply: connect to DATABASE_URL, resolve actor user (first bootstrap
//!     user unless --actor <email> is given), insert rows one at a time.

use std::path::PathBuf;

use team_presence_server::{
    error::AppError,
    stories::import::{
        apply_one, first_user, resolve_user_by_email, scan_dir, ApplyOutcome, ParsedStory,
    },
    stories::model::StoryStatus,
};
use uuid::Uuid;

struct Args {
    dir: PathBuf,
    apply: bool,
    dedup_by_title: bool,
    actor: Option<String>,
}

fn parse_args() -> Result<Args, String> {
    let mut it = std::env::args().skip(1);
    let mut dir: Option<PathBuf> = None;
    let mut apply = false;
    let mut dedup_by_title = false;
    let mut actor: Option<String> = None;

    while let Some(a) = it.next() {
        match a.as_str() {
            "--dir" => {
                dir = Some(
                    it.next()
                        .ok_or_else(|| "--dir needs a value".to_string())?
                        .into(),
                )
            }
            "--apply" => apply = true,
            "--dedup-by" => match it.next().as_deref() {
                Some("title") => dedup_by_title = true,
                other => return Err(format!("unknown --dedup-by value: {other:?}")),
            },
            "--actor" => {
                actor = Some(
                    it.next()
                        .ok_or_else(|| "--actor needs a value".to_string())?,
                )
            }
            "-h" | "--help" => {
                print_help();
                std::process::exit(0);
            }
            other => return Err(format!("unknown flag: {other}")),
        }
    }

    let dir = dir.ok_or_else(|| "missing --dir".to_string())?;
    Ok(Args {
        dir,
        apply,
        dedup_by_title,
        actor,
    })
}

fn print_help() {
    eprintln!(
        "Usage: import-bmad --dir <path> [--apply] [--dedup-by title] [--actor <email>]\n\n\
         Imports bmad *.md stories from <path> into the team-presence DB.\n\n\
         --dir        Directory containing *.md files (non-recursive).\n\
         --apply      Persist. Without this flag, only a dry-run preview is printed.\n\
         --dedup-by title  Skip files whose title already exists in the DB.\n\
         --actor <email>   Set last_modified_by to this user. Defaults to the\n\
                           oldest bootstrap user.\n"
    );
}

fn status_label(s: StoryStatus) -> &'static str {
    s.as_str()
}

fn print_preview(stories: &[ParsedStory]) {
    for p in stories {
        println!(
            "  + Story \"{}\"  [{}]  owner={}  file={}",
            p.title,
            status_label(p.status),
            p.owner_email.as_deref().unwrap_or("-"),
            p.source_file.display()
        );
        for w in &p.warnings {
            println!("      warn: {w}");
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Structured-log init mirrors server binary (stderr JSON in prod, pretty in TTY).
    team_presence_server::telemetry::init();

    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("error: {e}");
            print_help();
            std::process::exit(2);
        }
    };

    if !args.dir.is_dir() {
        eprintln!(
            "error: --dir {:?} does not exist or is not a directory",
            args.dir
        );
        std::process::exit(2);
    }

    let scan = scan_dir(&args.dir)?;

    println!(
        "Scanned {}: {} parsed, {} failed",
        args.dir.display(),
        scan.successes.len(),
        scan.failures.len()
    );
    for (path, err) in &scan.failures {
        eprintln!("  skip {}: {}", path.display(), err);
    }
    print_preview(&scan.successes);

    if !args.apply {
        println!(
            "\nDry-run. Pass --apply to persist {} stories.",
            scan.successes.len()
        );
        std::process::exit(if scan.failures.is_empty() { 0 } else { 1 });
    }

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://tp:tp@localhost:5433/team_presence".into());

    let db = sqlx::PgPool::connect(&database_url)
        .await
        .map_err(|e| anyhow::anyhow!("connect to {database_url}: {e}"))?;

    let actor_id = resolve_actor(&db, args.actor.as_deref()).await?;
    tracing::info!(
        component = "import_bmad",
        phase = "apply_start",
        actor_id = %actor_id,
        files = scan.successes.len(),
        dedup_by_title = args.dedup_by_title,
        "starting apply"
    );

    let mut created = 0usize;
    let mut skipped_dup = 0usize;
    let mut failed = 0usize;

    for parsed in &scan.successes {
        match apply_one(&db, actor_id, parsed, args.dedup_by_title).await {
            Ok(ApplyOutcome::Created(story)) => {
                created += 1;
                println!(
                    "  created  {:>36}  {}",
                    story.id,
                    parsed.source_file.display()
                );
            }
            Ok(ApplyOutcome::SkippedDuplicate { title }) => {
                skipped_dup += 1;
                println!("  skipped  duplicate title {:?}", title);
            }
            Err(e) => {
                failed += 1;
                eprintln!("  failed   {}: {}", parsed.source_file.display(), e);
            }
        }
    }

    println!(
        "\nSummary: {} created, {} skipped, {} failed, {} parse warnings",
        created,
        skipped_dup,
        failed,
        scan.failures.len()
    );

    if failed > 0 || !scan.failures.is_empty() {
        std::process::exit(1);
    }
    Ok(())
}

async fn resolve_actor(db: &sqlx::PgPool, actor: Option<&str>) -> anyhow::Result<Uuid> {
    let resolved: Result<Option<Uuid>, AppError> = match actor {
        Some(email) => resolve_user_by_email(db, email).await,
        None => first_user(db).await,
    };

    match resolved {
        Ok(Some(id)) => Ok(id),
        Ok(None) => Err(match actor {
            Some(e) => anyhow::anyhow!(
                "actor {:?} not found in users table — bootstrap a user first",
                e
            ),
            None => anyhow::anyhow!(
                "no users in DB — bootstrap one via POST /api/v1/auth/bootstrap, \
                 then re-run import-bmad"
            ),
        }),
        Err(e) => Err(anyhow::anyhow!("actor lookup: {e}")),
    }
}
