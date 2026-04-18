//! bmad markdown importer. Parses a directory of `*.md` files emitted by bmad's
//! `docs/stories/` convention and turns them into platform stories.
//!
//! Design posture (plan Unit 5):
//! - Dry-run by default, `--apply` persists.
//! - Frontmatter is tolerant: unknown keys are ignored, unknown status values
//!   record a warning and fall back to Todo.
//! - Title resolution chain: frontmatter `title:` → first `# H1` → filename stem.
//! - Files exceeding the 1 MB description cap are reported as failures; the
//!   caller (the binary) prints them as "skipped" so the dry-run stays useful.

use std::path::{Path, PathBuf};

use sqlx::PgPool;
use uuid::Uuid;

use super::model::{Story, StoryStatus};
use super::repo::{self, DESCRIPTION_MAX_BYTES, TITLE_MAX_BYTES};
use crate::error::AppError;

/// File size cap. Mirrors `DESCRIPTION_MAX_BYTES` from Unit 3 so an imported
/// story that passes parse won't be rejected by the INSERT.
pub const MAX_FILE_BYTES: usize = DESCRIPTION_MAX_BYTES;

#[derive(Debug, Default, serde::Deserialize)]
pub struct Frontmatter {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub owner: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedStory {
    pub source_file: PathBuf,
    pub title: String,
    pub description: String,
    pub status: StoryStatus,
    pub owner_email: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("file too large: {bytes} bytes (limit {limit})")]
    TooLarge { bytes: usize, limit: usize },
    #[error("i/o: {0}")]
    Io(#[from] std::io::Error),
    #[error("frontmatter yaml: {0}")]
    Frontmatter(String),
    #[error("title empty after all fallbacks")]
    EmptyTitle,
    #[error("title too long: {0} bytes")]
    TitleTooLong(usize),
}

#[derive(Debug, Default)]
pub struct ScanResult {
    pub successes: Vec<ParsedStory>,
    pub failures: Vec<(PathBuf, ParseError)>,
}

/// Split frontmatter off the leading `---` block if present.
/// Returns `(Some(yaml), body_after_closing_fence)` or `(None, full_input)`.
pub(crate) fn split_frontmatter(input: &str) -> (Option<&str>, &str) {
    let input = input.strip_prefix('\u{feff}').unwrap_or(input);
    let rest = match input
        .strip_prefix("---\n")
        .or_else(|| input.strip_prefix("---\r\n"))
    {
        Some(r) => r,
        None => return (None, input),
    };
    // Find the first line that is exactly `---`. Using split_inclusive so we
    // can compute the byte offset of the body without re-scanning.
    let mut offset = 0usize;
    for line in rest.split_inclusive('\n') {
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed == "---" {
            let fm = &rest[..offset];
            let body = &rest[offset + line.len()..];
            return (Some(fm), body);
        }
        offset += line.len();
    }
    // Opened but never closed — treat whole file as body, no frontmatter.
    (None, input)
}

fn first_h1(body: &str) -> Option<String> {
    for line in body.lines() {
        let t = line.trim_start();
        if let Some(rest) = t.strip_prefix("# ") {
            let s = rest.trim();
            if !s.is_empty() {
                return Some(s.to_string());
            }
        }
    }
    None
}

/// Map a free-form status string into the platform enum.
/// Returns `(mapped, known)` — when `known == false`, the caller should record
/// a warning and keep the default Todo.
pub fn map_status(raw: &str) -> (StoryStatus, bool) {
    let lower = raw.trim().to_ascii_lowercase();
    match lower.as_str() {
        "doing" | "in_progress" | "in-progress" | "in progress" | "wip" | "active" => {
            (StoryStatus::Doing, true)
        }
        "done" | "complete" | "completed" | "closed" | "finished" | "resolved" => {
            (StoryStatus::Done, true)
        }
        "todo" | "to do" | "to-do" | "backlog" | "open" | "new" | "pending" => {
            (StoryStatus::Todo, true)
        }
        _ => (StoryStatus::Todo, false),
    }
}

/// Parse a single file on disk. Caller owns the directory walk.
pub fn parse_file(path: &Path) -> Result<ParsedStory, ParseError> {
    let bytes = std::fs::metadata(path)?.len() as usize;
    if bytes > MAX_FILE_BYTES {
        return Err(ParseError::TooLarge {
            bytes,
            limit: MAX_FILE_BYTES,
        });
    }
    let raw = std::fs::read_to_string(path)?;
    parse_str(path, &raw)
}

/// Parse a string representing a single bmad file. Pure; used directly by tests.
pub fn parse_str(path: &Path, raw: &str) -> Result<ParsedStory, ParseError> {
    let mut warnings = Vec::new();
    let (fm_raw, body) = split_frontmatter(raw);

    let fm: Frontmatter = match fm_raw {
        Some(s) if !s.trim().is_empty() => {
            serde_yaml::from_str(s).map_err(|e| ParseError::Frontmatter(e.to_string()))?
        }
        _ => Frontmatter::default(),
    };

    let title = fm
        .title
        .as_deref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| first_h1(body))
        .or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
        .ok_or(ParseError::EmptyTitle)?;

    if title.len() > TITLE_MAX_BYTES {
        return Err(ParseError::TitleTooLong(title.len()));
    }

    let status = match fm.status.as_deref() {
        Some(s) => {
            let (st, known) = map_status(s);
            if !known {
                warnings.push(format!("unknown status {:?}, defaulting to todo", s.trim()));
            }
            st
        }
        None => StoryStatus::Todo,
    };

    let description = body.trim_start_matches(['\n', '\r']).to_string();
    if description.len() > DESCRIPTION_MAX_BYTES {
        return Err(ParseError::TooLarge {
            bytes: description.len(),
            limit: DESCRIPTION_MAX_BYTES,
        });
    }

    Ok(ParsedStory {
        source_file: path.to_path_buf(),
        title,
        description,
        status,
        owner_email: fm
            .owner
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        warnings,
    })
}

/// Walk `dir` for `*.md` files (non-recursive — bmad's `docs/stories/` is flat).
/// Sorted by path so dry-run output is stable.
pub fn scan_dir(dir: &Path) -> std::io::Result<ScanResult> {
    let mut result = ScanResult::default();
    let mut entries: Vec<PathBuf> = std::fs::read_dir(dir)?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("md"))
        .collect();
    entries.sort();

    for path in entries {
        match parse_file(&path) {
            Ok(parsed) => result.successes.push(parsed),
            Err(e) => result.failures.push((path, e)),
        }
    }
    Ok(result)
}

#[derive(Debug)]
pub enum ApplyOutcome {
    Created(Story),
    SkippedDuplicate { title: String },
}

/// Apply one parsed story to the DB. Each call is a single INSERT, so a failed
/// row leaves earlier rows intact — satisfies the plan's "tx-per-file" spirit
/// without a transaction wrapper.
pub async fn apply_one(
    db: &PgPool,
    actor: Uuid,
    parsed: &ParsedStory,
    dedup_by_title: bool,
) -> Result<ApplyOutcome, AppError> {
    if dedup_by_title {
        let existing: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM stories WHERE title = $1 LIMIT 1")
                .bind(&parsed.title)
                .fetch_optional(db)
                .await?;
        if existing.is_some() {
            return Ok(ApplyOutcome::SkippedDuplicate {
                title: parsed.title.clone(),
            });
        }
    }

    let owner_id = match &parsed.owner_email {
        Some(email) => resolve_user_by_email(db, email).await?,
        None => None,
    };

    let story = repo::create(
        db,
        actor,
        &parsed.title,
        &parsed.description,
        parsed.status,
        owner_id,
        None,
    )
    .await?;
    Ok(ApplyOutcome::Created(story))
}

pub async fn resolve_user_by_email(db: &PgPool, email: &str) -> Result<Option<Uuid>, AppError> {
    let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(db)
        .await?;
    Ok(row.map(|r| r.0))
}

/// Find the oldest user in the DB — used by the importer when `--actor` is
/// omitted (the bootstrap user is the sensible default).
pub async fn first_user(db: &PgPool) -> Result<Option<Uuid>, AppError> {
    let row: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
            .fetch_optional(db)
            .await?;
    Ok(row.map(|r| r.0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_frontmatter_happy_path() {
        let input = "---\ntitle: Hello\nstatus: doing\n---\nBody line.\n";
        let (fm, body) = split_frontmatter(input);
        assert_eq!(fm, Some("title: Hello\nstatus: doing\n"));
        assert_eq!(body, "Body line.\n");
    }

    #[test]
    fn split_frontmatter_none_when_no_fence() {
        let input = "# Title\n\nBody.\n";
        let (fm, body) = split_frontmatter(input);
        assert!(fm.is_none());
        assert_eq!(body, input);
    }

    #[test]
    fn split_frontmatter_handles_crlf() {
        let input = "---\r\ntitle: x\r\n---\r\nBody\r\n";
        let (fm, body) = split_frontmatter(input);
        assert!(fm.is_some());
        assert!(body.starts_with("Body"));
    }

    #[test]
    fn split_frontmatter_unterminated_treated_as_body() {
        let input = "---\ntitle: x\nno closing fence\n";
        let (fm, body) = split_frontmatter(input);
        assert!(fm.is_none());
        assert_eq!(body, input);
    }

    #[test]
    fn split_frontmatter_strips_bom() {
        let input = "\u{feff}---\ntitle: x\n---\nBody\n";
        let (fm, body) = split_frontmatter(input);
        assert!(fm.is_some());
        assert_eq!(body, "Body\n");
    }

    #[test]
    fn first_h1_skips_hash_without_space() {
        assert_eq!(first_h1("#nospace\n# Real\n"), Some("Real".into()));
    }

    #[test]
    fn first_h1_ignores_h2_and_below() {
        assert_eq!(first_h1("## H2\n### H3\n"), None);
    }

    #[test]
    fn first_h1_none_for_body_only() {
        assert_eq!(first_h1("just text\n"), None);
    }

    #[test]
    fn map_status_covers_all_known_synonyms() {
        for s in [
            "doing",
            "in_progress",
            "in-progress",
            "in progress",
            "WIP",
            "Active",
        ] {
            let (st, known) = map_status(s);
            assert_eq!(st, StoryStatus::Doing, "failed for {s}");
            assert!(known);
        }
        for s in [
            "Done",
            "complete",
            "completed",
            "closed",
            "finished",
            "resolved",
        ] {
            let (st, known) = map_status(s);
            assert_eq!(st, StoryStatus::Done, "failed for {s}");
            assert!(known);
        }
        for s in [
            "todo", "to do", "to-do", "backlog", "open", "new", "pending",
        ] {
            let (st, known) = map_status(s);
            assert_eq!(st, StoryStatus::Todo, "failed for {s}");
            assert!(known);
        }
    }

    #[test]
    fn map_status_unknown_defaults_todo_with_flag() {
        let (st, known) = map_status("blocked-by-legal");
        assert_eq!(st, StoryStatus::Todo);
        assert!(!known);
    }

    #[test]
    fn parse_str_uses_frontmatter_title_first() {
        let raw = "---\ntitle: Alpha\n---\n# H1 Header\nbody\n";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.title, "Alpha");
    }

    #[test]
    fn parse_str_falls_back_to_h1() {
        let raw = "# H1 Title\n\nbody\n";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.title, "H1 Title");
    }

    #[test]
    fn parse_str_falls_back_to_filename() {
        let raw = "plain body, no h1\n";
        let p = parse_str(Path::new("/path/to/story-42.md"), raw).unwrap();
        assert_eq!(p.title, "story-42");
    }

    #[test]
    fn parse_str_status_mapping_applied() {
        let raw = "---\ntitle: t\nstatus: in_progress\n---\nbody";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.status, StoryStatus::Doing);
        assert!(p.warnings.is_empty());
    }

    #[test]
    fn parse_str_unknown_status_records_warning() {
        let raw = "---\ntitle: t\nstatus: frobnicated\n---\nbody";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.status, StoryStatus::Todo);
        assert_eq!(p.warnings.len(), 1);
        assert!(p.warnings[0].contains("frobnicated"));
    }

    #[test]
    fn parse_str_unicode_title_preserved() {
        let raw = "---\ntitle: \"虾厂 🦐 sprint planning\"\n---\n";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.title, "虾厂 🦐 sprint planning");
    }

    #[test]
    fn parse_str_owner_email_extracted() {
        let raw = "---\ntitle: t\nowner: alice@team\n---\n";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.owner_email.as_deref(), Some("alice@team"));
    }

    #[test]
    fn parse_str_empty_frontmatter_ok() {
        let raw = "---\n---\n# Pure H1\nbody";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.title, "Pure H1");
    }

    #[test]
    fn parse_str_malformed_yaml_is_frontmatter_error() {
        let raw = "---\n: : : not valid : :\n---\nbody";
        let err = parse_str(Path::new("x.md"), raw).unwrap_err();
        assert!(matches!(err, ParseError::Frontmatter(_)));
    }

    #[test]
    fn parse_str_description_omits_frontmatter() {
        let raw = "---\ntitle: t\n---\nLine one\nLine two\n";
        let p = parse_str(Path::new("x.md"), raw).unwrap();
        assert_eq!(p.description, "Line one\nLine two\n");
    }

    #[test]
    fn scan_dir_ignores_non_md_and_dirs() {
        let tmp = tempdir();
        std::fs::write(tmp.join("a.md"), "# A\n").unwrap();
        std::fs::write(tmp.join("b.txt"), "# not md\n").unwrap();
        std::fs::create_dir(tmp.join("sub")).unwrap();
        std::fs::write(tmp.join("sub").join("c.md"), "# C\n").unwrap();

        let r = scan_dir(&tmp).unwrap();
        assert_eq!(r.successes.len(), 1);
        assert_eq!(r.successes[0].title, "A");
        // scrub
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn scan_dir_reports_too_large_as_failure() {
        let tmp = tempdir();
        let big = "a".repeat(MAX_FILE_BYTES + 1);
        std::fs::write(tmp.join("big.md"), &big).unwrap();
        let r = scan_dir(&tmp).unwrap();
        assert_eq!(r.failures.len(), 1);
        assert!(matches!(r.failures[0].1, ParseError::TooLarge { .. }));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn scan_dir_sorted_output() {
        let tmp = tempdir();
        std::fs::write(tmp.join("c.md"), "# C\n").unwrap();
        std::fs::write(tmp.join("a.md"), "# A\n").unwrap();
        std::fs::write(tmp.join("b.md"), "# B\n").unwrap();
        let r = scan_dir(&tmp).unwrap();
        let titles: Vec<_> = r.successes.iter().map(|p| p.title.clone()).collect();
        assert_eq!(titles, vec!["A".to_string(), "B".into(), "C".into()]);
        std::fs::remove_dir_all(&tmp).ok();
    }

    /// Tiny helper: create a unique temp dir without pulling in `tempfile` crate.
    fn tempdir() -> PathBuf {
        let base = std::env::temp_dir();
        let nonce = format!(
            "tp-import-test-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        );
        let dir = base.join(nonce);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}
