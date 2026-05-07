//! Tail Codex CLI state and emit shared `Frame`s.
//!
//! Codex stores thread metadata in `~/.codex/state_5.sqlite` and appends user
//! prompts to `~/.codex/history.jsonl`. This tailer uses the sqlite `threads`
//! table as the active-session source and forwards history lines as lightweight
//! room content so the Members page has real Codex session tiles.

use std::collections::{hash_map::Entry, HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::Duration;

use chrono::{TimeZone, Utc};
use serde::Deserialize;
use team_presence_shared_types::{AgentKind, Content, ContentRole, Frame};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::heartbeat::ActiveSessions;

const POLL_INTERVAL: Duration = Duration::from_millis(700);
const DEFAULT_ACTIVE_WINDOW: Duration = Duration::from_secs(24 * 60 * 60);
const DEFAULT_IDLE_END_AFTER: Duration = Duration::from_secs(8 * 60 * 60);

#[derive(Debug, Clone)]
struct CodexSessionState {
    last_seen_s: i64,
}

#[derive(Debug, Clone)]
struct CodexThread {
    id: Uuid,
    cwd: String,
    git_origin_url: Option<String>,
    git_branch: Option<String>,
    created_at_s: i64,
    updated_at_s: i64,
}

pub struct CodexTailer {
    state_db_path: PathBuf,
    history_path: PathBuf,
    tx: mpsc::Sender<Frame>,
    sessions: ActiveSessions,
    active: HashMap<Uuid, CodexSessionState>,
    seen_history: HashSet<(Uuid, i64, String)>,
    history_offset: u64,
}

impl CodexTailer {
    pub fn new(
        state_db_path: PathBuf,
        history_path: PathBuf,
        tx: mpsc::Sender<Frame>,
        sessions: ActiveSessions,
    ) -> Self {
        Self {
            state_db_path,
            history_path,
            tx,
            sessions,
            active: HashMap::new(),
            seen_history: HashSet::new(),
            history_offset: 0,
        }
    }

    pub async fn run(mut self) -> anyhow::Result<()> {
        tracing::info!(
            component = "collector.codex",
            phase = "tail_start",
            state_db = %self.state_db_path.display(),
            history = %self.history_path.display(),
            "tailing codex state"
        );

        loop {
            match self.poll_once() {
                Ok(frames) => {
                    for frame in frames {
                        if self.tx.send(frame).await.is_err() {
                            return Ok(());
                        }
                    }
                }
                Err(err) => {
                    tracing::debug!(
                        component = "collector.codex",
                        phase = "poll_err",
                        error = %err,
                        "codex poll failed"
                    );
                }
            }

            self.end_idle_active_sessions().await;
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    }

    fn poll_once(&mut self) -> anyhow::Result<Vec<Frame>> {
        let mut out = Vec::new();
        for thread in self.list_recent_threads()? {
            match self.active.entry(thread.id) {
                Entry::Vacant(entry) => {
                    entry.insert(CodexSessionState {
                        last_seen_s: thread.updated_at_s,
                    });
                    self.sessions.add(thread.id);
                    out.push(Frame::SessionStart {
                        session_id: thread.id,
                        cli: AgentKind::Codex,
                        cwd: thread.cwd,
                        git_remote: thread.git_origin_url,
                        git_branch: thread.git_branch,
                        transcript_path: Some(self.history_path.display().to_string()),
                        started_at: ts_from_seconds(thread.created_at_s),
                    });
                }
                Entry::Occupied(mut entry) => {
                    let state = entry.get_mut();
                    state.last_seen_s = state.last_seen_s.max(thread.updated_at_s);
                }
            }
        }

        out.extend(self.read_history_frames()?);
        Ok(out)
    }

    fn list_recent_threads(&self) -> anyhow::Result<Vec<CodexThread>> {
        if !self.state_db_path.exists() {
            return Ok(Vec::new());
        }
        let conn = rusqlite::Connection::open_with_flags(
            &self.state_db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;
        let min_updated_at = Utc::now().timestamp() - active_window().as_secs() as i64;
        let mut stmt = conn.prepare(
            "SELECT id, cwd, git_origin_url, git_branch, created_at, updated_at
             FROM threads
             WHERE archived = 0 AND updated_at >= ?1
             ORDER BY updated_at DESC
             LIMIT 32",
        )?;
        let rows = stmt.query_map([min_updated_at], |row| {
            let raw_id: String = row.get(0)?;
            let id = Uuid::parse_str(&raw_id).map_err(|err| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(err),
                )
            })?;
            Ok(CodexThread {
                id,
                cwd: row.get(1)?,
                git_origin_url: row.get(2)?,
                git_branch: row.get(3)?,
                created_at_s: row.get(4)?,
                updated_at_s: row.get(5)?,
            })
        })?;

        let mut threads = Vec::new();
        for row in rows {
            threads.push(row?);
        }
        Ok(threads)
    }

    fn read_history_frames(&mut self) -> anyhow::Result<Vec<Frame>> {
        if !self.history_path.exists() {
            return Ok(Vec::new());
        }
        let mut file = File::open(&self.history_path)?;
        let len = file.metadata()?.len();
        if len < self.history_offset {
            self.history_offset = 0;
            self.seen_history.clear();
        }
        file.seek(SeekFrom::Start(self.history_offset))?;
        let mut reader = BufReader::new(file);
        let mut out = Vec::new();
        let mut line = String::new();
        loop {
            line.clear();
            let bytes = reader.read_line(&mut line)?;
            if bytes == 0 {
                break;
            }
            if let Some(frame) = self.history_line_to_frame(&line) {
                out.push(frame);
            }
        }
        self.history_offset = reader.stream_position()?;
        Ok(out)
    }

    fn history_line_to_frame(&mut self, line: &str) -> Option<Frame> {
        let entry: CodexHistoryEntry = serde_json::from_str(line.trim()).ok()?;
        let session_id = Uuid::parse_str(&entry.session_id).ok()?;
        if !self.active.contains_key(&session_id) {
            return None;
        }
        if entry.text.trim().is_empty() {
            return None;
        }
        let key = (session_id, entry.ts, entry.text.clone());
        if !self.seen_history.insert(key) {
            return None;
        }
        Some(Frame::SessionContent {
            session_id,
            role: ContentRole::User,
            text: Content(entry.text),
            ts: ts_from_seconds(entry.ts),
        })
    }

    async fn end_idle_active_sessions(&mut self) {
        let Some(idle_end_after) = idle_end_after() else {
            return;
        };
        let now_s = Utc::now().timestamp();
        let mut to_end = Vec::new();
        for (session_id, state) in &self.active {
            if now_s.saturating_sub(state.last_seen_s) > idle_end_after.as_secs() as i64 {
                to_end.push(*session_id);
            }
        }
        for session_id in to_end {
            self.active.remove(&session_id);
            self.sessions.remove(session_id);
            let _ = self
                .tx
                .send(Frame::SessionEnd {
                    session_id,
                    ended_at: Utc::now(),
                    exit_code: None,
                })
                .await;
        }
    }
}

#[derive(Debug, Deserialize)]
struct CodexHistoryEntry {
    session_id: String,
    ts: i64,
    text: String,
}

pub fn default_state_db_path() -> PathBuf {
    match std::env::var_os("HOME") {
        Some(home) => PathBuf::from(home).join(".codex/state_5.sqlite"),
        None => PathBuf::from(".codex/state_5.sqlite"),
    }
}

pub fn default_history_path() -> PathBuf {
    match std::env::var_os("HOME") {
        Some(home) => PathBuf::from(home).join(".codex/history.jsonl"),
        None => PathBuf::from(".codex/history.jsonl"),
    }
}

fn active_window() -> Duration {
    std::env::var("TP_CODEX_ACTIVE_WINDOW_SECS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or(DEFAULT_ACTIVE_WINDOW)
}

fn idle_end_after() -> Option<Duration> {
    match std::env::var("TP_CODEX_IDLE_END_SECS").ok().as_deref() {
        Some("0") => None,
        Some(v) => v.parse::<u64>().ok().map(Duration::from_secs),
        None => Some(DEFAULT_IDLE_END_AFTER),
    }
}

fn ts_from_seconds(ts_s: i64) -> chrono::DateTime<Utc> {
    Utc.timestamp_opt(ts_s, 0).single().unwrap_or_else(Utc::now)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn poll_once_emits_codex_session_start_and_history_content() {
        let temp = TempDir::new().expect("tempdir");
        let db_path = temp.path().join("state_5.sqlite");
        let history_path = temp.path().join("history.jsonl");
        let session_id = Uuid::new_v4();
        seed_codex_state(&db_path, session_id);
        std::fs::write(
            &history_path,
            format!(r#"{{"session_id":"{session_id}","ts":1778137000,"text":"hello codex"}}"#)
                + "\n",
        )
        .expect("write history");

        let (tx, _rx) = tokio::sync::mpsc::channel(8);
        let sessions = ActiveSessions::default();
        let mut tailer = CodexTailer::new(db_path, history_path, tx, sessions);

        let frames = tailer.poll_once().expect("poll once");
        assert!(frames.iter().any(|frame| {
            matches!(
                frame,
                Frame::SessionStart {
                    session_id: id,
                    cli: AgentKind::Codex,
                    cwd,
                    ..
                } if *id == session_id && cwd == "/repo"
            )
        }));
        assert!(frames.iter().any(|frame| {
            matches!(
                frame,
                Frame::SessionContent {
                    session_id: id,
                    role: ContentRole::User,
                    text,
                    ..
                } if *id == session_id && text.0 == "hello codex"
            )
        }));
    }

    #[test]
    fn history_lines_for_unknown_threads_are_ignored() {
        let temp = TempDir::new().expect("tempdir");
        let db_path = temp.path().join("state_5.sqlite");
        let history_path = temp.path().join("history.jsonl");
        seed_empty_codex_state(&db_path);
        std::fs::write(
            &history_path,
            format!(
                r#"{{"session_id":"{}","ts":1778137000,"text":"orphan"}}"#,
                Uuid::new_v4()
            ) + "\n",
        )
        .expect("write history");

        let (tx, _rx) = tokio::sync::mpsc::channel(8);
        let sessions = ActiveSessions::default();
        let mut tailer = CodexTailer::new(db_path, history_path, tx, sessions);

        let frames = tailer.poll_once().expect("poll once");
        assert!(frames.is_empty());
    }

    fn seed_codex_state(path: &std::path::Path, session_id: Uuid) {
        seed_empty_codex_state(path);
        let conn = rusqlite::Connection::open(path).expect("open sqlite");
        let now = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO threads (
                id, rollout_path, created_at, updated_at, source, model_provider, cwd,
                title, sandbox_policy, approval_mode, tokens_used, has_user_event,
                archived, git_origin_url, git_branch, cli_version, first_user_message
             ) VALUES (?1, '', ?2, ?3, 'cli', 'openai', '/repo', 'Test thread',
                'danger-full-access', 'never', 0, 1, 0,
                'https://github.com/zstackio/ai-native-workspace', 'main', '', '')",
            rusqlite::params![session_id.to_string(), now - 10, now],
        )
        .expect("insert thread");
    }

    fn seed_empty_codex_state(path: &std::path::Path) {
        let conn = rusqlite::Connection::open(path).expect("open sqlite");
        conn.execute_batch(
            "
            CREATE TABLE threads (
                id TEXT PRIMARY KEY,
                rollout_path TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                source TEXT NOT NULL,
                model_provider TEXT NOT NULL,
                cwd TEXT NOT NULL,
                title TEXT NOT NULL,
                sandbox_policy TEXT NOT NULL,
                approval_mode TEXT NOT NULL,
                tokens_used INTEGER NOT NULL DEFAULT 0,
                has_user_event INTEGER NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0,
                git_origin_url TEXT,
                git_branch TEXT,
                cli_version TEXT NOT NULL DEFAULT '',
                first_user_message TEXT NOT NULL DEFAULT ''
            );
            ",
        )
        .expect("seed schema");
    }
}
