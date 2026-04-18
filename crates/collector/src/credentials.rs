//! Collector credential storage.
//!
//! Primary: OS keyring (macOS Keychain / libsecret / windows-native).
//! Fallback: `~/.config/team-presence/credentials.json` at 0600 in a 0700 dir.
//!
//! The fallback exists because keyring access can fail under headless CI, SSH
//! sessions without keyring-daemon, or locked keychains. When we fall back the
//! file's perms are the last line of defense, so we refuse to start if they've
//! drifted.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::{self, check_mode, credentials_path, set_mode};

const KEYRING_SERVICE: &str = "io.team-presence.collector";
const KEYRING_USER: &str = "default";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Credentials {
    /// Base server URL, e.g. `https://team-presence.example.com`. No trailing slash.
    pub server: String,
    pub user_email: String,
    pub collector_id: uuid::Uuid,
    pub collector_name: String,
    /// The opaque collector token, prefix `tp_<hex>`. Bearer value.
    pub token: String,
}

impl Credentials {
    pub fn new(
        server: String,
        user_email: String,
        collector_id: uuid::Uuid,
        collector_name: String,
        token: String,
    ) -> Self {
        Self {
            server: server.trim_end_matches('/').to_string(),
            user_email,
            collector_id,
            collector_name,
            token,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("i/o: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialize: {0}")]
    Json(#[from] serde_json::Error),
    #[error("keyring: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("{0}")]
    Other(String),
}

/// Save credentials to the primary store (keyring) with file fallback.
///
/// When `prefer_file` is true (tests / headless), the keyring is skipped.
pub fn save(creds: &Credentials, prefer_file: bool) -> Result<(), StoreError> {
    if !prefer_file {
        if let Err(e) = save_keyring(creds) {
            tracing::warn!(
                component = "collector.credentials",
                phase = "save",
                error = %e,
                "keyring save failed — falling back to file"
            );
        } else {
            // Remove stale file fallback so there's one source of truth.
            let _ = std::fs::remove_file(
                credentials_path().map_err(|e| StoreError::Other(e.to_string()))?,
            );
            return Ok(());
        }
    }
    save_file(
        creds,
        &credentials_path().map_err(|e| StoreError::Other(e.to_string()))?,
    )
}

/// Load credentials. Tries keyring first, then file. Returns `Ok(None)` if
/// neither store has an entry.
pub fn load() -> Result<Option<Credentials>, StoreError> {
    match load_keyring() {
        Ok(Some(c)) => return Ok(Some(c)),
        Ok(None) => {} // fall through
        Err(e) => {
            tracing::debug!(
                component = "collector.credentials",
                phase = "load_keyring",
                error = %e,
                "keyring read failed — trying file fallback"
            );
        }
    }
    let path = credentials_path().map_err(|e| StoreError::Other(e.to_string()))?;
    match load_file(&path) {
        Ok(opt) => Ok(opt),
        Err(StoreError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Delete credentials from every store we know about. Idempotent.
pub fn clear() -> Result<(), StoreError> {
    // Best-effort on keyring — missing entry is not an error.
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        let _ = entry.delete_credential();
    }
    let path = credentials_path().map_err(|e| StoreError::Other(e.to_string()))?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

fn save_keyring(creds: &Credentials) -> Result<(), StoreError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    let blob = serde_json::to_string(creds)?;
    entry.set_password(&blob)?;
    Ok(())
}

fn load_keyring() -> Result<Option<Credentials>, StoreError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(serde_json::from_str(&s)?)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(StoreError::Keyring(e)),
    }
}

pub fn save_file(creds: &Credentials, path: &Path) -> Result<(), StoreError> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
            config::set_mode(parent, 0o700).map_err(|e| StoreError::Other(e.to_string()))?;
        }
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(creds)?)?;
    set_mode(&tmp, 0o600).map_err(|e| StoreError::Other(e.to_string()))?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

pub fn load_file(path: &Path) -> Result<Option<Credentials>, StoreError> {
    if !path.exists() {
        return Ok(None);
    }
    check_mode(path, 0o600, "credentials file").map_err(|e| StoreError::Other(e.to_string()))?;
    let raw = std::fs::read_to_string(path)?;
    let creds: Credentials = serde_json::from_str(&raw)?;
    Ok(Some(creds))
}

/// Used by `status`, test helpers, and ad-hoc debugging.
pub fn fallback_path() -> anyhow::Result<PathBuf> {
    credentials_path()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::TempDir;

    fn fixture() -> Credentials {
        Credentials::new(
            "https://team.example.com".into(),
            "alice@example".into(),
            uuid::Uuid::new_v4(),
            "alice-laptop".into(),
            "tp_deadbeef".into(),
        )
    }

    #[test]
    fn save_and_load_round_trip_via_file() {
        let tmp = TempDir::new().unwrap();
        // Give the temp dir the required 0700 so check_mode is happy.
        std::fs::set_permissions(tmp.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
        let path = tmp.path().join("credentials.json");
        let creds = fixture();
        save_file(&creds, &path).unwrap();

        let loaded = load_file(&path).unwrap().unwrap();
        assert_eq!(loaded, creds);
    }

    #[test]
    fn file_mode_is_0600_after_save() {
        let tmp = TempDir::new().unwrap();
        std::fs::set_permissions(tmp.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
        let path = tmp.path().join("credentials.json");
        save_file(&fixture(), &path).unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(
            mode, 0o600,
            "credentials file must be 0600 (got {:o})",
            mode
        );
    }

    #[test]
    fn load_refuses_world_readable_file() {
        let tmp = TempDir::new().unwrap();
        std::fs::set_permissions(tmp.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
        let path = tmp.path().join("credentials.json");
        save_file(&fixture(), &path).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();

        let err = load_file(&path).unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("mode") && msg.contains("600"),
            "expected mode mismatch error, got: {msg}"
        );
    }

    #[test]
    fn load_returns_none_when_file_absent() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("nope.json");
        assert!(load_file(&path).unwrap().is_none());
    }

    #[test]
    fn trailing_slash_stripped_from_server() {
        let c = Credentials::new(
            "https://ex.com/".into(),
            "a@b".into(),
            uuid::Uuid::new_v4(),
            "l".into(),
            "tp_x".into(),
        );
        assert_eq!(c.server, "https://ex.com");
    }
}
