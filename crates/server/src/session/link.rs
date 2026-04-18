//! Regex-based story linking.
//!
//! Plan default regex: `(?i)(?:^|[/-])((STORY|S)-\d+)(?:[/-]|$)`. Evaluated
//! against `git_branch` and `cwd` fields on session_start. Captured token
//! (e.g. "STORY-12") is looked up by case-insensitive title match.
//!
//! Phase 2 will load team override rules from a config file; for MVP we ship
//! a single hard-coded regex so the feature has no deploy surface.

use once_cell::sync::Lazy;
use regex::Regex;
use sqlx::PgPool;
use uuid::Uuid;

static DEFAULT_LINK_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:^|[/\-])((?:STORY|S)-\d+)(?:[/\-]|$)")
        .expect("default story link regex is valid")
});

/// Extract candidate story tokens from any subset of branch/cwd/remote strings.
/// Returns unique uppercased tokens in first-seen order (e.g. ["STORY-12"]).
pub fn extract_tokens<'a, I: IntoIterator<Item = &'a str>>(inputs: I) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for s in inputs {
        for cap in DEFAULT_LINK_RE.captures_iter(s) {
            if let Some(m) = cap.get(1) {
                let tok = m.as_str().to_ascii_uppercase();
                if !out.contains(&tok) {
                    out.push(tok);
                }
            }
        }
    }
    out
}

/// Resolve captured tokens to an existing story by title substring (ILIKE).
/// Returns the first match; if multiple tokens match different stories we
/// prefer the first candidate token. None when no token matches any story.
pub async fn resolve_story_id(
    db: &PgPool,
    git_branch: Option<&str>,
    cwd: Option<&str>,
) -> sqlx::Result<Option<Uuid>> {
    let inputs: Vec<&str> = [git_branch, cwd].into_iter().flatten().collect();
    if inputs.is_empty() {
        return Ok(None);
    }
    let tokens = extract_tokens(inputs.iter().copied());
    for tok in tokens {
        let pat = format!("%{tok}%");
        let row: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM stories WHERE name ILIKE $1 ORDER BY created_at ASC LIMIT 1",
        )
        .bind(&pat)
        .fetch_optional(db)
        .await?;
        if let Some((id,)) = row {
            return Ok(Some(id));
        }
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_story_from_branch() {
        let got = extract_tokens(["feat/STORY-12-add-widget"]);
        assert_eq!(got, vec!["STORY-12"]);
    }

    #[test]
    fn extracts_short_form_s_prefix() {
        let got = extract_tokens(["bugfix/s-7/reticulate"]);
        assert_eq!(got, vec!["S-7"]);
    }

    #[test]
    fn case_insensitive_match() {
        let got = extract_tokens(["feat/story-99"]);
        assert_eq!(got, vec!["STORY-99"]);
    }

    #[test]
    fn multiple_sources_deduped_preserving_first_seen() {
        let got = extract_tokens([
            "feat/STORY-1-x",
            "/home/user/work/STORY-1",
            "feat/STORY-2",
        ]);
        assert_eq!(got, vec!["STORY-1", "STORY-2"]);
    }

    #[test]
    fn no_match_when_prefix_missing() {
        let got = extract_tokens(["feat/totally-unrelated"]);
        assert!(got.is_empty());
    }

    #[test]
    fn requires_delimiter_to_avoid_partial_match() {
        // Plan regex uses /,- as delimiters so "xSTORY-1" should NOT match.
        let got = extract_tokens(["xSTORY-1x"]);
        assert!(got.is_empty());
    }

    #[test]
    fn matches_bare_token_when_standalone() {
        // Bare "STORY-12" at line boundaries should still match.
        let got = extract_tokens(["STORY-12"]);
        assert_eq!(got, vec!["STORY-12"]);
    }
}
