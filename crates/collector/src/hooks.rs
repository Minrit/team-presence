//! Install / uninstall claude-code hook scripts.
//!
//! Claude Code invokes hook scripts via stdin+env when a `SessionStart` or
//! `Stop` event fires; the plan's capture strategy is to read the hook's
//! JSON payload, find `transcript_path` on SessionStart, and push a lifecycle
//! frame onto the collector's local unix socket.
//!
//! This module writes the shell scripts and a settings shim. The daemon-side
//! socket listener + transcript tail lives in Phase B.

use std::path::{Path, PathBuf};

use crate::config::{hook_socket_path, set_mode};

pub const SESSION_START_HOOK_NAME: &str = "team-presence-session-start.sh";
pub const STOP_HOOK_NAME: &str = "team-presence-stop.sh";

pub fn default_hooks_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".claude").join("hooks"))
}

pub fn session_start_script(socket: &Path) -> String {
    format!(
        "#!/usr/bin/env bash\n\
         # team-presence SessionStart hook — installed by `team-presence install-hooks`.\n\
         # Forwards Claude Code's stdin JSON (includes transcript_path + session_id)\n\
         # to the local collector socket. Does nothing if the collector is not running.\n\
         set -eu\n\
         SOCK=\"{sock}\"\n\
         if command -v nc >/dev/null 2>&1; then\n\
         \tpayload=\"$(cat)\"\n\
         \tprintf '%s\\n' \"{{\\\"kind\\\":\\\"session_start\\\",\\\"payload\\\":$payload}}\" \\\n\
         \t\t| nc -U -w 1 \"$SOCK\" 2>/dev/null || true\n\
         fi\n\
         exit 0\n",
        sock = socket.display()
    )
}

pub fn stop_script(socket: &Path) -> String {
    format!(
        "#!/usr/bin/env bash\n\
         # team-presence Stop hook — installed by `team-presence install-hooks`.\n\
         set -eu\n\
         SOCK=\"{sock}\"\n\
         if command -v nc >/dev/null 2>&1; then\n\
         \tpayload=\"$(cat)\"\n\
         \tprintf '%s\\n' \"{{\\\"kind\\\":\\\"stop\\\",\\\"payload\\\":$payload}}\" \\\n\
         \t\t| nc -U -w 1 \"$SOCK\" 2>/dev/null || true\n\
         fi\n\
         exit 0\n",
        sock = socket.display()
    )
}

#[derive(Debug)]
pub struct InstallReport {
    pub dir: PathBuf,
    pub installed: Vec<PathBuf>,
    pub skipped: Vec<PathBuf>,
}

pub fn install(dir: Option<PathBuf>, force: bool) -> anyhow::Result<InstallReport> {
    let dir = dir
        .or_else(default_hooks_dir)
        .ok_or_else(|| anyhow::anyhow!("HOME not set; pass --dir to choose a hooks directory"))?;
    std::fs::create_dir_all(&dir)?;

    let socket = hook_socket_path();
    let mut report = InstallReport {
        dir: dir.clone(),
        installed: Vec::new(),
        skipped: Vec::new(),
    };

    for (name, body) in [
        (SESSION_START_HOOK_NAME, session_start_script(&socket)),
        (STOP_HOOK_NAME, stop_script(&socket)),
    ] {
        let path = dir.join(name);
        if path.exists() && !force {
            report.skipped.push(path);
            continue;
        }
        std::fs::write(&path, body)?;
        let _ = set_mode(&path, 0o755);
        report.installed.push(path);
    }

    Ok(report)
}

pub fn uninstall(dir: Option<PathBuf>) -> anyhow::Result<Vec<PathBuf>> {
    let dir = dir
        .or_else(default_hooks_dir)
        .ok_or_else(|| anyhow::anyhow!("HOME not set; pass --dir to choose a hooks directory"))?;
    let mut removed = Vec::new();
    for name in [SESSION_START_HOOK_NAME, STOP_HOOK_NAME] {
        let path = dir.join(name);
        if path.exists() {
            std::fs::remove_file(&path)?;
            removed.push(path);
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::TempDir;

    #[test]
    fn install_writes_both_scripts_executable() {
        let tmp = TempDir::new().unwrap();
        let report = install(Some(tmp.path().to_path_buf()), false).unwrap();
        assert_eq!(report.installed.len(), 2);
        for p in &report.installed {
            let mode = std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o755, "{} should be 0755", p.display());
            let body = std::fs::read_to_string(p).unwrap();
            assert!(body.starts_with("#!/usr/bin/env bash"));
        }
    }

    #[test]
    fn reinstall_without_force_skips() {
        let tmp = TempDir::new().unwrap();
        install(Some(tmp.path().to_path_buf()), false).unwrap();
        let second = install(Some(tmp.path().to_path_buf()), false).unwrap();
        assert!(second.installed.is_empty());
        assert_eq!(second.skipped.len(), 2);
    }

    #[test]
    fn force_overwrites_existing() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().to_path_buf();
        install(Some(dir.clone()), false).unwrap();
        // Corrupt one file.
        std::fs::write(dir.join(SESSION_START_HOOK_NAME), "junk").unwrap();

        let again = install(Some(dir.clone()), true).unwrap();
        assert_eq!(again.installed.len(), 2);
        let body = std::fs::read_to_string(dir.join(SESSION_START_HOOK_NAME)).unwrap();
        assert!(body.contains("session_start"));
    }

    #[test]
    fn uninstall_removes_scripts() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().to_path_buf();
        install(Some(dir.clone()), false).unwrap();
        let removed = uninstall(Some(dir.clone())).unwrap();
        assert_eq!(removed.len(), 2);
        assert!(!dir.join(SESSION_START_HOOK_NAME).exists());
    }

    #[test]
    fn uninstall_idempotent() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().to_path_buf();
        let removed = uninstall(Some(dir.clone())).unwrap();
        assert!(removed.is_empty());
    }
}
