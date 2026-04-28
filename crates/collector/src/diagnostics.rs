use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};

use crate::{config, credentials, mute};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenCodeDbState {
    Readable,
    Missing,
    NotAFile,
    PermissionDenied,
    SqliteOpenFailed,
}

impl OpenCodeDbState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Readable => "readable",
            Self::Missing => "missing",
            Self::NotAFile => "not_a_file",
            Self::PermissionDenied => "permission_denied",
            Self::SqliteOpenFailed => "sqlite_open_failed",
        }
    }

    pub fn hint(self, path: &Path) -> Option<String> {
        let p = path.display();
        match self {
            Self::Readable => None,
            Self::Missing => Some(format!(
                "opencode db not found at {p}; start OpenCode once, then re-run status"
            )),
            Self::NotAFile => Some(format!(
                "path {p} is not a file; remove/fix it so collector can read sqlite"
            )),
            Self::PermissionDenied => Some(format!(
                "permission denied reading {p}; adjust file permissions for current user"
            )),
            Self::SqliteOpenFailed => Some(format!(
                "cannot open sqlite at {p}; verify it is a healthy opencode.db"
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct OpenCodeDbHealth {
    pub path: PathBuf,
    pub state: OpenCodeDbState,
    pub last_event_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub struct CollectorStatusReport {
    pub logged_in: bool,
    pub server: Option<String>,
    pub user_email: Option<String>,
    pub collector_name: Option<String>,
    pub collector_id: Option<String>,
    pub muted: bool,
    pub config_dir: PathBuf,
    pub fallback_path: PathBuf,
    pub socket_path: PathBuf,
    pub opencode_db: OpenCodeDbHealth,
}

pub fn collect_status() -> anyhow::Result<CollectorStatusReport> {
    let creds = credentials::load()?;
    let opencode_db = inspect_opencode_db();

    Ok(CollectorStatusReport {
        logged_in: creds.is_some(),
        server: creds.as_ref().map(|c| c.server.clone()),
        user_email: creds.as_ref().map(|c| c.user_email.clone()),
        collector_name: creds.as_ref().map(|c| c.collector_name.clone()),
        collector_id: creds.as_ref().map(|c| c.collector_id.to_string()),
        muted: mute::is_muted(),
        config_dir: config::config_dir()?,
        fallback_path: credentials::fallback_path()?,
        socket_path: config::hook_socket_path(),
        opencode_db,
    })
}

fn inspect_opencode_db() -> OpenCodeDbHealth {
    let path = opencode_db_path();
    let state = opencode_db_state(&path);
    let last_event_at = if matches!(state, OpenCodeDbState::Readable) {
        read_last_event_ts(&path)
    } else {
        None
    };
    OpenCodeDbHealth {
        path,
        state,
        last_event_at,
    }
}

fn opencode_db_path() -> PathBuf {
    match std::env::var_os("HOME") {
        Some(home) => PathBuf::from(home).join(".local/share/opencode/opencode.db"),
        None => PathBuf::from(".local/share/opencode/opencode.db"),
    }
}

fn opencode_db_state(path: &Path) -> OpenCodeDbState {
    let meta = match std::fs::metadata(path) {
        Ok(m) => m,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return OpenCodeDbState::Missing;
        }
        Err(err) if err.kind() == std::io::ErrorKind::PermissionDenied => {
            return OpenCodeDbState::PermissionDenied;
        }
        Err(_) => return OpenCodeDbState::SqliteOpenFailed,
    };
    if !meta.is_file() {
        return OpenCodeDbState::NotAFile;
    }
    match rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY) {
        Ok(_) => OpenCodeDbState::Readable,
        Err(rusqlite::Error::SqliteFailure(err, _))
            if err.code == rusqlite::ErrorCode::PermissionDenied =>
        {
            OpenCodeDbState::PermissionDenied
        }
        Err(_) => OpenCodeDbState::SqliteOpenFailed,
    }
}

fn read_last_event_ts(path: &Path) -> Option<DateTime<Utc>> {
    let conn = rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .ok()?;
    let ts_ms: Option<i64> = conn
        .query_row("SELECT MAX(time_updated) FROM part", [], |row| row.get(0))
        .ok()
        .flatten();
    ts_ms.and_then(ts_from_millis)
}

fn ts_from_millis(ts_ms: i64) -> Option<DateTime<Utc>> {
    chrono::TimeZone::timestamp_millis_opt(&Utc, ts_ms).single()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn db_state_missing_for_absent_path() {
        let p = PathBuf::from("/definitely/not/found/opencode.db");
        assert_eq!(opencode_db_state(&p), OpenCodeDbState::Missing);
    }

    #[test]
    fn db_state_not_a_file_for_directory_path() {
        let temp = tempfile::tempdir().expect("tempdir");
        assert_eq!(opencode_db_state(temp.path()), OpenCodeDbState::NotAFile);
    }
}
