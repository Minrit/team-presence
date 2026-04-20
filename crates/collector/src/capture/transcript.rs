//! Tail a Claude Code `transcript_path` JSONL file and emit `Frame`s.
//!
//! The file is append-only during a session; we read once to find EOF, then
//! poll for growth every 200 ms. Polling beats `notify`/`inotify` here because
//! (a) transcripts are short-lived, (b) cross-platform semantics are trivial,
//! (c) 200 ms matches the ~sub-2s P95 the plan wants without chasing fs-event
//! pitfalls (renames, atomic-replace editors, etc. — not relevant for Claude's
//! append writer, but nice to rule out).

use std::io::SeekFrom;
use std::path::PathBuf;
use std::time::Duration;

use chrono::Utc;
use team_presence_shared_types::{Content, ContentRole, Frame};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio::sync::mpsc;
use uuid::Uuid;

/// How often we check the file for growth. 200 ms is a knob; shorter is more
/// responsive, longer is cheaper. At 5/sec × 6 active sessions this is 30
/// stat() syscalls/sec — negligible.
const POLL_INTERVAL: Duration = Duration::from_millis(200);

/// Minimum bytes between reads. Prevents emitting half-written lines when
/// Claude Code flushes mid-record. Complete JSON per line is the contract,
/// but partial writes exist in the wild — we buffer and only split on \n.
const MIN_READ_CHUNK: u64 = 64;

/// How long the transcript file may stay missing before we abandon the tail.
/// Claude Code (especially when launched via cmux, tmux wrappers, or with a
/// resumed session id) can delay creating the transcript file for several
/// minutes after SessionStart fires — the old 30-second window declared the
/// session dead before a single byte was ever written. 10 minutes covers the
/// observed cases while still bounding ghost tailers if the path never shows.
const MISSING_GRACE: Duration = Duration::from_secs(600);

pub struct Tailer {
    session_id: Uuid,
    path: PathBuf,
    position: u64,
    carry: String,
    tx: mpsc::Sender<Frame>,
}

impl Tailer {
    pub fn new(session_id: Uuid, path: PathBuf, tx: mpsc::Sender<Frame>) -> Self {
        Self {
            session_id,
            path,
            position: 0,
            carry: String::new(),
            tx,
        }
    }

    /// Run until the consumer drops or the file is missing longer than
    /// `MISSING_GRACE`.
    pub async fn run(mut self) -> anyhow::Result<()> {
        tracing::info!(
            component = "collector.transcript",
            phase = "tail_start",
            session_id = %self.session_id,
            path = %self.path.display(),
            "tailing transcript"
        );

        let mut missing_since: Option<std::time::Instant> = None;
        loop {
            match self.poll_once().await {
                Ok(true) => missing_since = None,
                Ok(false) => {
                    if missing_since.is_none() {
                        missing_since = Some(std::time::Instant::now());
                    }
                    if missing_since
                        .map(|t| t.elapsed() > MISSING_GRACE)
                        .unwrap_or(false)
                    {
                        tracing::warn!(
                            component = "collector.transcript",
                            phase = "tail_stop_missing",
                            session_id = %self.session_id,
                            path = %self.path.display(),
                            grace_secs = MISSING_GRACE.as_secs(),
                            "transcript never appeared — stopping tail"
                        );
                        break;
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        component = "collector.transcript",
                        phase = "tail_error",
                        session_id = %self.session_id,
                        error = %e,
                        "tail iteration failed"
                    );
                }
            }
            tokio::time::sleep(POLL_INTERVAL).await;
        }

        Ok(())
    }

    /// Returns Ok(true) if the file exists, Ok(false) if missing.
    async fn poll_once(&mut self) -> anyhow::Result<bool> {
        let len = match tokio::fs::metadata(&self.path).await {
            Ok(m) => m.len(),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(e) => return Err(e.into()),
        };

        // Claude Code will sometimes truncate and rewrite the transcript on
        // resume. If the file shrinks below our recorded position, treat it as
        // a fresh file and start reading from byte 0.
        if len < self.position {
            tracing::info!(
                component = "collector.transcript",
                phase = "tail_reset_truncated",
                session_id = %self.session_id,
                path = %self.path.display(),
                prev_position = self.position,
                new_len = len,
                "transcript shrank — restarting from offset 0"
            );
            self.position = 0;
            self.carry.clear();
        }

        if len == self.position {
            return Ok(true);
        }
        if len - self.position < MIN_READ_CHUNK && !self.carry.is_empty() {
            // Wait for more data before splitting — reduces half-line risk.
        }

        let mut f = tokio::fs::File::open(&self.path).await?;
        f.seek(SeekFrom::Start(self.position)).await?;
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).await?;
        self.position = len;

        let chunk = match std::str::from_utf8(&buf) {
            Ok(s) => s.to_string(),
            Err(_) => String::from_utf8_lossy(&buf).into_owned(),
        };
        self.carry.push_str(&chunk);

        while let Some(nl) = self.carry.find('\n') {
            let line = self.carry[..nl].to_string();
            self.carry.drain(..=nl);
            for frame in parse_record(&line, self.session_id) {
                if self.tx.send(frame).await.is_err() {
                    return Ok(true);
                }
            }
        }
        Ok(true)
    }
}

/// Parse one JSONL record into zero-or-more content frames.
/// Returns a Vec because one `assistant` record may include multiple content
/// blocks (thinking + text + tool_use). We emit one frame per visible block.
pub fn parse_record(line: &str, session_id: Uuid) -> Vec<Frame> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let root: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(v) => v,
        Err(_) => return Vec::new(), // log-and-skip per plan
    };

    let record_type = root.get("type").and_then(|v| v.as_str()).unwrap_or("");
    // Skip non-message records wholesale.
    match record_type {
        "user" | "assistant" => {}
        _ => return Vec::new(),
    }

    let is_meta = root
        .get("isMeta")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if is_meta {
        return Vec::new();
    }

    let ts = root
        .get("timestamp")
        .and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    let message = match root.get("message") {
        Some(m) => m,
        None => return Vec::new(),
    };
    let role = message.get("role").and_then(|v| v.as_str()).unwrap_or("");

    let default_role = match role {
        "user" => ContentRole::User,
        "assistant" => ContentRole::Assistant,
        _ => return Vec::new(),
    };

    let content = match message.get("content") {
        Some(c) => c,
        None => return Vec::new(),
    };

    match content {
        serde_json::Value::String(s) if !s.is_empty() => vec![Frame::SessionContent {
            session_id,
            role: default_role,
            text: Content(s.clone()),
            ts,
        }],
        serde_json::Value::Array(blocks) => blocks
            .iter()
            .filter_map(|b| block_to_frame(session_id, default_role, ts, b))
            .collect(),
        _ => Vec::new(),
    }
}

fn block_to_frame(
    session_id: Uuid,
    default_role: ContentRole,
    ts: chrono::DateTime<Utc>,
    block: &serde_json::Value,
) -> Option<Frame> {
    let kind = block.get("type").and_then(|v| v.as_str())?;
    match kind {
        "text" => {
            let text = block.get("text").and_then(|v| v.as_str())?.to_string();
            if text.is_empty() {
                return None;
            }
            Some(Frame::SessionContent {
                session_id,
                role: default_role,
                text: Content(text),
                ts,
            })
        }
        "thinking" => None, // thinking is private — skip
        "tool_use" => {
            let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("?");
            let input = block
                .get("input")
                .map(summarize_json)
                .unwrap_or_else(|| "{}".into());
            Some(Frame::SessionContent {
                session_id,
                role: ContentRole::ToolUse,
                text: Content(format!("{name}: {input}")),
                ts,
            })
        }
        "tool_result" => {
            let raw = block.get("content");
            let body = match raw {
                Some(serde_json::Value::String(s)) => s.clone(),
                Some(v) => summarize_json(v),
                None => String::new(),
            };
            if body.is_empty() {
                return None;
            }
            Some(Frame::SessionContent {
                session_id,
                role: ContentRole::ToolResult,
                text: Content(body),
                ts,
            })
        }
        _ => None, // forward-compat: unknown block kinds logged-and-skipped at caller
    }
}

fn summarize_json(v: &serde_json::Value) -> String {
    let raw = serde_json::to_string(v).unwrap_or_default();
    if raw.len() > 2048 {
        format!("{}…[{} more]", &raw[..2048], raw.len() - 2048)
    } else {
        raw
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sid() -> Uuid {
        Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
    }

    #[test]
    fn parses_plain_user_string_content() {
        let raw = r#"{"type":"user","message":{"role":"user","content":"hello world"},"timestamp":"2026-04-18T10:00:00Z"}"#;
        let frames = parse_record(raw, sid());
        assert_eq!(frames.len(), 1);
        match &frames[0] {
            Frame::SessionContent { role, text, .. } => {
                assert_eq!(*role, ContentRole::User);
                assert_eq!(text.0, "hello world");
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn parses_assistant_text_block() {
        let raw = r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi there"}]}}"#;
        let frames = parse_record(raw, sid());
        assert_eq!(frames.len(), 1);
        assert!(matches!(
            frames[0],
            Frame::SessionContent {
                role: ContentRole::Assistant,
                ..
            }
        ));
    }

    #[test]
    fn assistant_thinking_block_suppressed() {
        let raw = r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking","thinking":"private"},{"type":"text","text":"public"}]}}"#;
        let frames = parse_record(raw, sid());
        assert_eq!(frames.len(), 1);
        if let Frame::SessionContent { text, .. } = &frames[0] {
            assert_eq!(text.0, "public");
        }
    }

    #[test]
    fn tool_use_block_emits_tooluse_role() {
        let raw = r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}"#;
        let frames = parse_record(raw, sid());
        assert_eq!(frames.len(), 1);
        match &frames[0] {
            Frame::SessionContent { role, text, .. } => {
                assert_eq!(*role, ContentRole::ToolUse);
                assert!(text.0.starts_with("Bash:"));
                assert!(text.0.contains("ls"));
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn tool_result_emits_toolresult_role() {
        let raw = r#"{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"stdout: hi"}]}}"#;
        let frames = parse_record(raw, sid());
        assert_eq!(frames.len(), 1);
        match &frames[0] {
            Frame::SessionContent { role, text, .. } => {
                assert_eq!(*role, ContentRole::ToolResult);
                assert_eq!(text.0, "stdout: hi");
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn meta_user_messages_suppressed() {
        let raw =
            r#"{"type":"user","isMeta":true,"message":{"role":"user","content":"<command>"}}"#;
        let frames = parse_record(raw, sid());
        assert!(frames.is_empty());
    }

    #[test]
    fn non_message_record_types_skipped() {
        for raw in [
            r#"{"type":"file-history-snapshot"}"#,
            r#"{"type":"queue-operation"}"#,
            r#"{"type":"system"}"#,
            r#"{"type":"permission-mode","permissionMode":"bypassPermissions"}"#,
        ] {
            assert!(parse_record(raw, sid()).is_empty(), "should skip: {raw}");
        }
    }

    #[test]
    fn malformed_json_returns_empty() {
        assert!(parse_record("not json", sid()).is_empty());
        assert!(parse_record("", sid()).is_empty());
    }

    #[test]
    fn multiple_text_blocks_yield_multiple_frames() {
        let raw = r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"a"},{"type":"text","text":"b"}]}}"#;
        let frames = parse_record(raw, sid());
        assert_eq!(frames.len(), 2);
    }

    #[test]
    fn tool_use_input_longer_than_2k_is_truncated() {
        let big = "x".repeat(3000);
        let raw = format!(
            r#"{{"type":"assistant","message":{{"role":"assistant","content":[{{"type":"tool_use","name":"Bash","input":{{"command":"{big}"}}}}]}}}}"#
        );
        let frames = parse_record(&raw, sid());
        if let Frame::SessionContent { text, .. } = &frames[0] {
            assert!(text.0.len() < big.len() + 64);
            assert!(text.0.contains("…"));
        } else {
            panic!();
        }
    }

    #[tokio::test]
    async fn tail_survives_file_truncate_and_rewrite() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().join("t.jsonl");
        // Seed with a long initial record and wait for the tailer to consume it.
        let long_filler = "x".repeat(1024);
        let first = format!(
            r#"{{"type":"user","message":{{"role":"user","content":"one {long_filler}"}}}}"#
        );
        tokio::fs::write(&path, format!("{first}\n").as_bytes())
            .await
            .unwrap();

        let (tx, mut rx) = mpsc::channel(16);
        let tailer = Tailer::new(sid(), path.clone(), tx);
        let handle = tokio::spawn(tailer.run());

        let got = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .expect("first frame")
            .unwrap();
        if let Frame::SessionContent { text, .. } = got {
            assert!(text.0.starts_with("one "));
        }

        // Simulate Claude Code rewriting the transcript on resume: shorter
        // content replaces the long initial file.
        let second = r#"{"type":"user","message":{"role":"user","content":"two"}}"#;
        tokio::fs::write(&path, format!("{second}\n").as_bytes())
            .await
            .unwrap();

        let got = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .expect("second frame after truncate")
            .unwrap();
        if let Frame::SessionContent { text, .. } = got {
            assert_eq!(
                text.0, "two",
                "tailer must re-read from 0 when file shrinks"
            );
        } else {
            panic!("wrong frame");
        }

        handle.abort();
    }

    #[tokio::test]
    async fn tail_waits_for_lazily_created_file() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().join("late.jsonl");
        // File does NOT exist when the tailer starts.
        let (tx, mut rx) = mpsc::channel(16);
        let tailer = Tailer::new(sid(), path.clone(), tx);
        let handle = tokio::spawn(tailer.run());

        // Create the file 400 ms later — well past the old 30s give-up would
        // not matter here, but this confirms the tailer tolerates a missing
        // start and still picks up content when it appears.
        tokio::time::sleep(Duration::from_millis(400)).await;
        let line = r#"{"type":"user","message":{"role":"user","content":"late"}}"#;
        tokio::fs::write(&path, format!("{line}\n").as_bytes())
            .await
            .unwrap();

        let got = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .expect("tailer should deliver lazy-created content")
            .unwrap();
        if let Frame::SessionContent { text, .. } = got {
            assert_eq!(text.0, "late");
        } else {
            panic!("wrong frame");
        }
        handle.abort();
    }

    #[tokio::test]
    async fn tail_real_file_emits_frames_as_lines_append() {
        let tmp = tempfile::TempDir::new().unwrap();
        let path = tmp.path().join("t.jsonl");
        tokio::fs::write(&path, b"").await.unwrap();

        let (tx, mut rx) = mpsc::channel(16);
        let tailer = Tailer::new(sid(), path.clone(), tx);
        let handle = tokio::spawn(tailer.run());

        // Append a full record.
        tokio::time::sleep(Duration::from_millis(50)).await;
        let line = r#"{"type":"user","message":{"role":"user","content":"hi"},"timestamp":"2026-04-18T10:00:00Z"}"#;
        tokio::fs::write(&path, format!("{line}\n").as_bytes())
            .await
            .unwrap();

        let got = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .expect("tailer should deliver within timeout")
            .expect("channel open");
        if let Frame::SessionContent { text, .. } = got {
            assert_eq!(text.0, "hi");
        } else {
            panic!("wrong frame");
        }

        handle.abort();
    }
}
