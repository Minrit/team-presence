//! Tail OpenCode sqlite storage and emit shared `Frame`s.

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use chrono::{TimeZone, Utc};
use team_presence_shared_types::{AgentKind, Content, ContentRole, Frame};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::heartbeat::ActiveSessions;

const POLL_INTERVAL: Duration = Duration::from_millis(400);
const DEFAULT_IDLE_END_AFTER: Duration = Duration::from_secs(8 * 60 * 60);
const SEEN_CACHE_MAX: usize = 50_000;

#[derive(Debug, Clone)]
struct SourceSessionState {
    tp_session_id: Uuid,
    last_seen_ms: i64,
}

pub struct OpenCodeTailer {
    agent_kind: AgentKind,
    db_path: PathBuf,
    tx: mpsc::Sender<Frame>,
    sessions: ActiveSessions,
    last_time_updated: i64,
    last_part_id: String,
    seen_part_updates: HashMap<String, i64>,
    primed: bool,
    source_sessions: HashMap<String, SourceSessionState>,
    active_source_session: Option<String>,
}

impl OpenCodeTailer {
    pub fn new(
        agent_kind: AgentKind,
        db_path: PathBuf,
        tx: mpsc::Sender<Frame>,
        sessions: ActiveSessions,
    ) -> Self {
        Self {
            agent_kind,
            db_path,
            tx,
            sessions,
            last_time_updated: 0,
            last_part_id: String::new(),
            seen_part_updates: HashMap::new(),
            primed: false,
            source_sessions: HashMap::new(),
            active_source_session: None,
        }
    }

    pub async fn run(mut self) -> anyhow::Result<()> {
        tracing::info!(
            component = "collector.opencode",
            phase = "tail_start",
            cli = %self.agent_kind.as_str(),
            db = %self.db_path.display(),
            "tailing opencode sqlite"
        );

        loop {
            if !self.db_path.exists() {
                tokio::time::sleep(POLL_INTERVAL).await;
                continue;
            }

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
                        component = "collector.opencode",
                        phase = "poll_err",
                        error = %err,
                        "opencode poll failed"
                    );
                }
            }

            self.end_idle_active_session_if_needed().await;
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    }

    fn poll_once(&mut self) -> anyhow::Result<Vec<Frame>> {
        let conn = rusqlite::Connection::open_with_flags(
            &self.db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;

        if !self.primed {
            let max_existing: Option<i64> = conn
                .query_row("SELECT MAX(time_updated) FROM part", [], |r| r.get(0))
                .ok()
                .flatten();
            self.last_time_updated = max_existing.unwrap_or(0);
            self.last_part_id = String::new();
            self.primed = true;
            return Ok(Vec::new());
        }

        let mut stmt = conn.prepare(
            "SELECT p.id, p.session_id, p.time_updated, p.data, m.data
             FROM part p
             LEFT JOIN message m ON m.id = p.message_id
             WHERE p.time_updated > ?1
                OR (p.time_updated = ?1 AND p.id > ?2)
             ORDER BY p.time_updated ASC, p.id ASC
             LIMIT 500",
        )?;

        let mut rows = stmt.query(rusqlite::params![self.last_time_updated, self.last_part_id])?;
        let mut out = Vec::new();
        let mut max_time = self.last_time_updated;
        let mut max_part_id = self.last_part_id.clone();

        while let Some(row) = rows.next()? {
            let part_id: String = row.get(0)?;
            let source_session_id: String = row.get(1)?;
            let time_updated: i64 = row.get(2)?;
            let part_data: String = row.get(3)?;
            let message_data: Option<String> = row.get(4).ok();

            if time_updated > max_time {
                max_time = time_updated;
                max_part_id = part_id.clone();
            } else if time_updated == max_time && part_id > max_part_id {
                max_part_id = part_id.clone();
            }

            if self
                .seen_part_updates
                .get(&part_id)
                .map(|seen_ts| *seen_ts >= time_updated)
                .unwrap_or(false)
            {
                continue;
            }
            self.seen_part_updates.insert(part_id, time_updated);
            if self.seen_part_updates.len() > SEEN_CACHE_MAX {
                self.seen_part_updates.clear();
            }

            out.extend(self.route_part(
                &conn,
                &source_session_id,
                time_updated,
                &part_data,
                message_data.as_deref(),
            )?);
        }

        self.last_time_updated = max_time;
        self.last_part_id = max_part_id;
        Ok(out)
    }

    fn route_part(
        &mut self,
        conn: &rusqlite::Connection,
        source_session_id: &str,
        time_updated_ms: i64,
        part_data: &str,
        message_data: Option<&str>,
    ) -> anyhow::Result<Vec<Frame>> {
        let mut out = Vec::new();

        self.active_source_session = Some(source_session_id.to_string());

        if !self.source_sessions.contains_key(source_session_id) {
            let tp_session_id = Uuid::new_v4();
            let cwd = lookup_session_cwd(conn, source_session_id)
                .or_else(|| std::env::current_dir().ok().map(|p| p.display().to_string()))
                .unwrap_or_else(|| "?".to_string());

            self.source_sessions.insert(
                source_session_id.to_string(),
                SourceSessionState {
                    tp_session_id,
                    last_seen_ms: time_updated_ms,
                },
            );

            self.sessions.add(tp_session_id);
            out.push(Frame::SessionStart {
                session_id: tp_session_id,
                cli: self.agent_kind,
                cwd,
                git_remote: None,
                git_branch: None,
                transcript_path: None,
                started_at: Utc::now(),
            });
        }

        if let Some(state) = self.source_sessions.get_mut(source_session_id) {
            state.last_seen_ms = time_updated_ms;
            out.extend(part_to_frames(
                state.tp_session_id,
                time_updated_ms,
                part_data,
                message_data,
            ));
        }

        Ok(out)
    }

    async fn end_idle_active_session_if_needed(&mut self) {
        let Some(idle_end_after) = idle_end_after() else {
            return;
        };
        let now_ms = Utc::now().timestamp_millis();
        let mut to_end = Vec::new();
        for (source_id, state) in &self.source_sessions {
            if now_ms.saturating_sub(state.last_seen_ms) > idle_end_after.as_millis() as i64 {
                to_end.push(source_id.clone());
            }
        }

        for source_id in to_end {
            if let Some(state) = self.source_sessions.remove(&source_id) {
                self.sessions.remove(state.tp_session_id);
                let _ = self
                    .tx
                    .send(Frame::SessionEnd {
                        session_id: state.tp_session_id,
                        ended_at: Utc::now(),
                        exit_code: None,
                    })
                    .await;
            }
            if self.active_source_session.as_deref() == Some(source_id.as_str()) {
                self.active_source_session = None;
            }
        }
    }
}

fn idle_end_after() -> Option<Duration> {
    let raw = std::env::var("TP_OPENCODE_IDLE_END_SECS").ok();
    match raw.as_deref() {
        Some("0") => None,
        Some(v) => v.parse::<u64>().ok().map(Duration::from_secs),
        None => Some(DEFAULT_IDLE_END_AFTER),
    }
}

fn lookup_session_cwd(conn: &rusqlite::Connection, source_session_id: &str) -> Option<String> {
    conn.query_row(
        "SELECT directory FROM session WHERE id = ?1",
        [source_session_id],
        |r| r.get(0),
    )
    .ok()
    .flatten()
}

fn part_to_frames(
    session_id: Uuid,
    time_updated_ms: i64,
    part_data: &str,
    message_data: Option<&str>,
) -> Vec<Frame> {
    let v: serde_json::Value = match serde_json::from_str(part_data) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let part_type = v.get("type").and_then(|x| x.as_str()).unwrap_or("");

    let ts = Utc
        .timestamp_millis_opt(time_updated_ms)
        .single()
        .unwrap_or_else(Utc::now);

    match part_type {
        "text" => {
            let text = v
                .get("text")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            if text.is_empty() {
                return Vec::new();
            }
            let role = message_role_from_data(message_data).unwrap_or(ContentRole::Assistant);
            vec![Frame::SessionContent {
                session_id,
                role,
                text: Content(text),
                ts,
            }]
        }
        "tool" => tool_frames(session_id, ts, &v),
        "reasoning" => {
            let text = v
                .get("text")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let body = if !text.is_empty() {
                format!("[reasoning] {text}")
            } else if has_encrypted_reasoning(&v) {
                "[reasoning] encrypted by provider (not available in plaintext)".to_string()
            } else {
                String::new()
            };
            if body.is_empty() {
                return Vec::new();
            }
            vec![Frame::SessionContent {
                session_id,
                role: ContentRole::Meta,
                text: Content(body),
                ts,
            }]
        }
        "step-start" => vec![Frame::SessionContent {
            session_id,
            role: ContentRole::Meta,
            text: Content("[step] started".to_string()),
            ts,
        }],
        "step-finish" => {
            let summary = render_step_finish(&v);
            vec![Frame::SessionContent {
                session_id,
                role: ContentRole::Meta,
                text: Content(summary),
                ts,
            }]
        }
        "file" => {
            let text = v
                .get("url")
                .and_then(|x| x.as_str())
                .unwrap_or("file")
                .to_string();
            vec![Frame::SessionContent {
                session_id,
                role: ContentRole::Meta,
                text: Content(text),
                ts,
            }]
        }
        _ => Vec::new(),
    }
}

fn has_encrypted_reasoning(v: &serde_json::Value) -> bool {
    v.get("metadata")
        .and_then(|m| m.get("openai"))
        .and_then(|o| o.get("reasoningEncryptedContent"))
        .and_then(|r| r.as_str())
        .map(|s| !s.is_empty())
        .unwrap_or(false)
}

fn render_step_finish(v: &serde_json::Value) -> String {
    let reason = v.get("reason").and_then(|x| x.as_str()).unwrap_or("unknown");
    let reasoning_tokens = v
        .get("tokens")
        .and_then(|t| t.get("reasoning"))
        .and_then(|x| x.as_i64())
        .unwrap_or(0);
    let output_tokens = v
        .get("tokens")
        .and_then(|t| t.get("output"))
        .and_then(|x| x.as_i64())
        .unwrap_or(0);
    format!(
        "[step] finished ({reason}) - reasoning_tokens={reasoning_tokens}, output_tokens={output_tokens}"
    )
}

fn tool_frames(session_id: Uuid, ts: chrono::DateTime<Utc>, v: &serde_json::Value) -> Vec<Frame> {
    let tool = v.get("tool").and_then(|x| x.as_str()).unwrap_or("tool");
    let call_id = v.get("callID").and_then(|x| x.as_str()).unwrap_or("");
    let state = v.get("state").cloned().unwrap_or(serde_json::Value::Null);
    let status = state
        .get("status")
        .and_then(|x| x.as_str())
        .unwrap_or("unknown");
    let input = state.get("input");
    let output = state.get("output");

    let rendered_input = input.map(render_tool_input).unwrap_or_default();
    let use_text = if rendered_input.is_empty() {
        if call_id.is_empty() {
            format!("{tool} [{status}]")
        } else {
            format!("{tool} [{status}] ({call_id})")
        }
    } else if call_id.is_empty() {
        format!("{tool} {rendered_input} [{status}]")
    } else {
        format!("{tool} {rendered_input} [{status}] ({call_id})")
    };

    let mut frames = vec![Frame::SessionContent {
        session_id,
        role: ContentRole::ToolUse,
        text: Content(use_text),
        ts,
    }];

    if let Some(out) = output {
        let rendered_output = render_tool_output(out, status);
        if !rendered_output.is_empty() {
            frames.push(Frame::SessionContent {
                session_id,
                role: ContentRole::ToolResult,
                text: Content(rendered_output),
                ts,
            });
        }
    } else if status == "completed" {
        frames.push(Frame::SessionContent {
            session_id,
            role: ContentRole::ToolResult,
            text: Content("completed (no output)".to_string()),
            ts,
        });
    }

    frames
}

fn message_role_from_data(message_data: Option<&str>) -> Option<ContentRole> {
    let raw = message_data?;
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let role = v.get("role").and_then(|r| r.as_str())?;
    match role {
        "user" => Some(ContentRole::User),
        "assistant" => Some(ContentRole::Assistant),
        _ => None,
    }
}

fn render_tool_input(input: &serde_json::Value) -> String {
    if let Some(cmd) = input.get("command").and_then(|x| x.as_str()) {
        return cmd.to_string();
    }
    if let Some(path) = input.get("filePath").and_then(|x| x.as_str()) {
        return path.to_string();
    }
    summarize_json(input)
}

fn render_tool_output(output: &serde_json::Value, status: &str) -> String {
    match output {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Object(map) => {
            let stdout = map
                .get("stdout")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim();
            let stderr = map
                .get("stderr")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim();
            let exit_code = map.get("exitCode").and_then(|x| x.as_i64());

            let mut chunks = Vec::new();
            if !stdout.is_empty() {
                chunks.push(stdout.to_string());
            }
            if !stderr.is_empty() {
                chunks.push(format!("stderr: {stderr}"));
            }
            if chunks.is_empty() {
                if let Some(code) = exit_code {
                    return format!("status={status}, exitCode={code}");
                }
                return summarize_json(output);
            }
            chunks.join("\n")
        }
        _ => summarize_json(output),
    }
}

fn summarize_json(v: &serde_json::Value) -> String {
    let raw = serde_json::to_string(v).unwrap_or_default();
    if raw.len() > 4096 {
        format!("{}...[{} more]", &raw[..4096], raw.len() - 4096)
    } else {
        raw
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_part_emits_use_and_result_frames() {
        let data = r#"{
            "type":"tool",
            "tool":"bash",
            "callID":"call_x",
            "state":{
              "status":"completed",
              "input":{"command":"ls -la"},
              "output":{"stdout":"ok","stderr":"","exitCode":0}
            }
        }"#;
        let sid = Uuid::new_v4();
        let frames = part_to_frames(sid, 1_777_000_000_000, data, None);
        assert_eq!(frames.len(), 2);
        match &frames[0] {
            Frame::SessionContent { role, text, .. } => {
                assert_eq!(*role, ContentRole::ToolUse);
                assert!(text.0.contains("bash"));
                assert!(text.0.contains("ls -la"));
                assert!(text.0.contains("completed"));
            }
            _ => panic!("unexpected frame variant"),
        }
        match &frames[1] {
            Frame::SessionContent { role, text, .. } => {
                assert_eq!(*role, ContentRole::ToolResult);
                assert!(text.0.contains("ok"));
            }
            _ => panic!("unexpected frame variant"),
        }
    }

    #[test]
    fn text_part_uses_message_role_when_available() {
        let part = r#"{"type":"text","text":"hello"}"#;
        let msg = r#"{"role":"user"}"#;
        let sid = Uuid::new_v4();
        let frames = part_to_frames(sid, 1_777_000_000_000, part, Some(msg));
        assert_eq!(frames.len(), 1);
        match &frames[0] {
            Frame::SessionContent { role, .. } => assert_eq!(*role, ContentRole::User),
            _ => panic!("unexpected frame variant"),
        }
    }

    #[test]
    fn reasoning_part_with_encrypted_payload_emits_meta_hint() {
        let part = r#"{
          "type":"reasoning",
          "text":"",
          "metadata":{"openai":{"reasoningEncryptedContent":"abc"}}
        }"#;
        let sid = Uuid::new_v4();
        let frames = part_to_frames(sid, 1_777_000_000_000, part, None);
        assert_eq!(frames.len(), 1);
        match &frames[0] {
            Frame::SessionContent { role, text, .. } => {
                assert_eq!(*role, ContentRole::Meta);
                assert!(text.0.contains("encrypted"));
            }
            _ => panic!("unexpected frame variant"),
        }
    }

    #[test]
    fn ordering_watermark_uses_part_id_tie_breaker() {
        let mut items = vec![
            (100_i64, "prt_b".to_string()),
            (100_i64, "prt_a".to_string()),
            (101_i64, "prt_c".to_string()),
        ];
        items.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
        assert_eq!(items[0].1, "prt_a");
        assert_eq!(items[1].1, "prt_b");
        assert_eq!(items[2].1, "prt_c");
    }
}
